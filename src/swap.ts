import {
  Account,
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { AccountLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TokenSwap, Numberu64, CurveType } from '@solana/spl-token-swap';
import { newAccountWithLamports } from './util/new-account-with-lamports';
import { sleep } from './util/sleep';

// The following globals are created by `createTokenSwap` and used by subsequent tests
// Token swap
let tokenSwap: TokenSwap;
// authority of the token and accounts
let authority: PublicKey;
// bump seed used to generate the authority public key
let bumpSeed: number;
// owner of the user accounts
let owner: Account;
// Token pool
let tokenPool: Token;
let tokenAccountPool: PublicKey;
let feeAccount: PublicKey;
// Tokens swapped
let mintA: Token;
let mintB: Token;
let tokenAccountA: PublicKey;
let tokenAccountB: PublicKey;

// TOKEN_SWAP_PROGRAM_ID
// const TOKEN_SWAP_PROGRAM_ID: PublicKey = new PublicKey(
//   'SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8'
// );
const TOKEN_SWAP_PROGRAM_ID: PublicKey = new PublicKey(
  'SwapsVeCiPHMUAtzQWZw7RjsKjgCjhwU55QGu4U1Szw'
);

// Hard-coded fee address, for testing production mode
const SWAP_PROGRAM_OWNER_FEE_ADDRESS =
  process.env.SWAP_PROGRAM_OWNER_FEE_ADDRESS;

// Pool fees
const TRADING_FEE_NUMERATOR = 25;
const TRADING_FEE_DENOMINATOR = 10000;
const OWNER_TRADING_FEE_NUMERATOR = 5;
const OWNER_TRADING_FEE_DENOMINATOR = 10000;
const OWNER_WITHDRAW_FEE_NUMERATOR = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 0 : 1;
const OWNER_WITHDRAW_FEE_DENOMINATOR = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 0 : 6;
const HOST_FEE_NUMERATOR = 20;
const HOST_FEE_DENOMINATOR = 100;

// Initial amount in each swap token
let currentSwapTokenA = 1000000;
let currentSwapTokenB = 1000000;
let currentFeeAmount = 0;

// Swap instruction constants
// Because there is no withdraw fee in the production version, these numbers
// need to get slightly tweaked in the two cases.
const SWAP_AMOUNT_IN = 100000;

let connection: Connection;
async function getConnection(): Promise<Connection> {
  if (connection) return connection;

  const url = 'https://api.devnet.solana.com';

  connection = new Connection(url, 'recent');
  const version = await connection.getVersion();

  console.log('Connection to cluster established:', url, version);
  return connection;
}

export async function createTokenSwap(
  curveType: number,
  curveParameters?: Numberu64 | undefined
): Promise<void> {
  const connection = await getConnection();
  const payer = await newAccountWithLamports(connection, 1000000000);
  owner = await newAccountWithLamports(connection, 1000000000);
  const tokenSwapAccount = new Account();

  // tokenSwap PDA
  [authority, bumpSeed] = await PublicKey.findProgramAddress(
    [tokenSwapAccount.publicKey.toBuffer()],
    TOKEN_SWAP_PROGRAM_ID
  );

  console.log('creating pool mint');
  tokenPool = await Token.createMint(
    connection,
    payer,
    authority,
    null,
    2,
    TOKEN_PROGRAM_ID
  );

  console.log('creating pool account');
  tokenAccountPool = await tokenPool.createAccount(owner.publicKey);
  const ownerKey = SWAP_PROGRAM_OWNER_FEE_ADDRESS || owner.publicKey.toString();
  feeAccount = await tokenPool.createAccount(new PublicKey(ownerKey));

  console.log('creating token A');
  mintA = await Token.createMint(
    connection,
    payer,
    owner.publicKey,
    null,
    2,
    TOKEN_PROGRAM_ID
  );

  console.log('creating token A account');
  tokenAccountA = await mintA.createAccount(authority);
  console.log('minting token A to swap');
  await mintA.mintTo(tokenAccountA, owner, [], currentSwapTokenA);

  console.log('creating token B');
  mintB = await Token.createMint(
    connection,
    payer,
    owner.publicKey,
    null,
    2,
    TOKEN_PROGRAM_ID
  );

  console.log('creating token B account');
  tokenAccountB = await mintB.createAccount(authority);
  console.log('minting token B to swap');
  await mintB.mintTo(tokenAccountB, owner, [], currentSwapTokenB);

  console.log('creating token swap');
  const swapPayer = await newAccountWithLamports(connection, 1000000000);
  tokenSwap = await TokenSwap.createTokenSwap(
    connection,
    swapPayer,
    tokenSwapAccount,
    authority,
    tokenAccountA,
    tokenAccountB,
    tokenPool.publicKey,
    mintA.publicKey,
    mintB.publicKey,
    feeAccount,
    tokenAccountPool,
    TOKEN_SWAP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    TRADING_FEE_NUMERATOR,
    TRADING_FEE_DENOMINATOR,
    OWNER_TRADING_FEE_NUMERATOR,
    OWNER_TRADING_FEE_DENOMINATOR,
    OWNER_WITHDRAW_FEE_NUMERATOR,
    OWNER_WITHDRAW_FEE_DENOMINATOR,
    HOST_FEE_NUMERATOR,
    HOST_FEE_DENOMINATOR,
    curveType,
    curveParameters
  );

  console.log('loading token swap');
  const fetchedTokenSwap = await TokenSwap.loadTokenSwap(
    connection,
    tokenSwapAccount.publicKey,
    TOKEN_SWAP_PROGRAM_ID,
    swapPayer
  );

  console.log('Creating swap token a account');
  let userAccountA = await mintA.createAccount(owner.publicKey);
  await mintA.mintTo(userAccountA, owner, [], SWAP_AMOUNT_IN);

  // @ts-ignore
  const balanceNeeded = await Token.getMinBalanceRentForExemptAccount(
    connection
  );
  const newAccount = new Account();
  const transaction = new Transaction();
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: owner.publicKey,
      newAccountPubkey: newAccount.publicKey,
      lamports: balanceNeeded,
      space: AccountLayout.span,
      programId: mintB.programId,
    })
  );

  transaction.add(
    Token.createInitAccountInstruction(
      mintB.programId,
      mintB.publicKey,
      newAccount.publicKey,
      owner.publicKey
    )
  );

  const userTransferAuthority = new Account();
  transaction.add(
    Token.createApproveInstruction(
      mintA.programId,
      userAccountA,
      userTransferAuthority.publicKey,
      owner.publicKey,
      [owner],
      SWAP_AMOUNT_IN
    )
  );

  transaction.add(
    TokenSwap.swapInstruction(
      tokenSwap.tokenSwap,
      tokenSwap.authority,
      userTransferAuthority.publicKey,
      userAccountA,
      tokenSwap.tokenAccountA,
      tokenSwap.tokenAccountB,
      newAccount.publicKey,
      tokenSwap.poolToken,
      tokenSwap.feeAccount,
      null,
      tokenSwap.swapProgramId,
      tokenSwap.tokenProgramId,
      SWAP_AMOUNT_IN,
      0
    )
  );

  const confirmOptions = {
    skipPreflight: true,
  };

  // Send the instructions
  console.log('sending big instruction');
  const txid = await sendAndConfirmTransaction(
    connection,
    transaction,
    [owner, newAccount, userTransferAuthority],
    confirmOptions
  );
  console.log(`https://solscan.io/tx/${txid}`);
  console.log(`or \n`);
  console.log(`https://explorer.solana.com/tx/${txid}`);
}

createTokenSwap(0);
