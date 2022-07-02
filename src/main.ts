import { createTokenSwap, createAccountAndSwapAtomic } from './swap';
import { CurveType, Numberu64 } from '@solana/spl-token-swap';

async function main() {
  console.log('createTokenSwap pool (constant product)');
  await createTokenSwap(CurveType.ConstantProduct);
  console.log('create account, approve, swap all at once');
  await createAccountAndSwapAtomic();
  console.log('Success\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());
