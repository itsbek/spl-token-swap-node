import { Account, Connection, PublicKey } from '@solana/web3.js';
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
const SWAP_AMOUNT_OUT = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 90661 : 90674;
const SWAP_FEE = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 22273 : 22277;
const HOST_SWAP_FEE = SWAP_PROGRAM_OWNER_FEE_ADDRESS
  ? Math.floor((SWAP_FEE * HOST_FEE_NUMERATOR) / HOST_FEE_DENOMINATOR)
  : 0;
const OWNER_SWAP_FEE = SWAP_FEE - HOST_SWAP_FEE;

// Pool token amount minted on init
const DEFAULT_POOL_TOKEN_AMOUNT = 1000000000;
// Pool token amount to withdraw / deposit
const POOL_TOKEN_AMOUNT = 10000000;

function assert(condition: boolean, message?: string) {
  if (!condition) {
    console.log(Error().stack + ':token-test.js');
    throw message || 'Assertion failed';
  }
  console.log('assertion success:', condition);
}

let connection: Connection;
async function getConnection(): Promise<Connection> {
  if (connection) return connection;

  // const url = 'http://localhost:8899';
  const url = 'https://api.devnet.solana.com';
  // const url = 'https://devnet.genesysgo.net/';
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

  assert(fetchedTokenSwap.tokenProgramId.equals(TOKEN_PROGRAM_ID));
  assert(fetchedTokenSwap.tokenAccountA.equals(tokenAccountA));
  assert(fetchedTokenSwap.tokenAccountB.equals(tokenAccountB));
  assert(fetchedTokenSwap.mintA.equals(mintA.publicKey));
  assert(fetchedTokenSwap.mintB.equals(mintB.publicKey));
  assert(fetchedTokenSwap.poolToken.equals(tokenPool.publicKey));
  assert(fetchedTokenSwap.feeAccount.equals(feeAccount));
  assert(
    TRADING_FEE_NUMERATOR == fetchedTokenSwap.tradeFeeNumerator.toNumber()
  );
  assert(
    TRADING_FEE_DENOMINATOR == fetchedTokenSwap.tradeFeeDenominator.toNumber()
  );
  assert(
    OWNER_TRADING_FEE_NUMERATOR ==
      fetchedTokenSwap.ownerTradeFeeNumerator.toNumber()
  );
  assert(
    OWNER_TRADING_FEE_DENOMINATOR ==
      fetchedTokenSwap.ownerTradeFeeDenominator.toNumber()
  );
  assert(
    OWNER_WITHDRAW_FEE_NUMERATOR ==
      fetchedTokenSwap.ownerWithdrawFeeNumerator.toNumber()
  );
  assert(
    OWNER_WITHDRAW_FEE_DENOMINATOR ==
      fetchedTokenSwap.ownerWithdrawFeeDenominator.toNumber()
  );
  assert(HOST_FEE_NUMERATOR == fetchedTokenSwap.hostFeeNumerator.toNumber());
  assert(
    HOST_FEE_DENOMINATOR == fetchedTokenSwap.hostFeeDenominator.toNumber()
  );
  assert(curveType == fetchedTokenSwap.curveType);
}

export async function swap(): Promise<void> {
  console.log('Creating swap token a account');
  let userAccountA = await mintA.createAccount(owner.publicKey);
  await mintA.mintTo(userAccountA, owner, [], SWAP_AMOUNT_IN);
  const userTransferAuthority = new Account();
  await mintA.approve(
    userAccountA,
    userTransferAuthority.publicKey,
    owner,
    [],
    SWAP_AMOUNT_IN
  );
  console.log('Creating swap token b account');
  let userAccountB = await mintB.createAccount(owner.publicKey);
  let poolAccount = SWAP_PROGRAM_OWNER_FEE_ADDRESS
    ? await tokenPool.createAccount(owner.publicKey)
    : null;

  const confirmOptions = {
    skipPreflight: true,
  };
  console.log(confirmOptions);

  console.log('Swapping');
  await tokenSwap.swap(
    userAccountA,
    tokenAccountA,
    tokenAccountB,
    userAccountB,
    poolAccount,
    userTransferAuthority,
    SWAP_AMOUNT_IN,
    SWAP_AMOUNT_OUT,
    confirmOptions
  );

  await sleep(5000);

  let info;
  info = await mintA.getAccountInfo(userAccountA);
  assert(info.amount.toNumber() == 0);

  info = await mintB.getAccountInfo(userAccountB);
  assert(info.amount.toNumber() == SWAP_AMOUNT_OUT);

  info = await mintA.getAccountInfo(tokenAccountA);
  assert(info.amount.toNumber() == currentSwapTokenA + SWAP_AMOUNT_IN);
  currentSwapTokenA += SWAP_AMOUNT_IN;

  info = await mintB.getAccountInfo(tokenAccountB);
  assert(info.amount.toNumber() == currentSwapTokenB - SWAP_AMOUNT_OUT);
  currentSwapTokenB -= SWAP_AMOUNT_OUT;

  info = await tokenPool.getAccountInfo(tokenAccountPool);
  assert(
    info.amount.toNumber() == DEFAULT_POOL_TOKEN_AMOUNT - POOL_TOKEN_AMOUNT
  );

  info = await tokenPool.getAccountInfo(feeAccount);
  assert(info.amount.toNumber() == currentFeeAmount + OWNER_SWAP_FEE);

  if (poolAccount != null) {
    info = await tokenPool.getAccountInfo(poolAccount);
    assert(info.amount.toNumber() == HOST_SWAP_FEE);
  }
}
