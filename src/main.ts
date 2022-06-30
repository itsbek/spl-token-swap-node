import { createTokenSwap, swap } from './swap';
import { CurveType, Numberu64 } from '@solana/spl-token-swap';

async function main() {
  // These test cases are designed to run sequentially and in the following order
  //   console.log('Run test: createTokenSwap (constant price)');
  //   await createTokenSwap(CurveType.ConstantPrice, new Numberu64(1));
  console.log(
    'Run test: createTokenSwap (constant product, used further in tests)'
  );
  await createTokenSwap(CurveType.ConstantProduct);
  console.log('Run test: swap');
  await swap();
  console.log('Success\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());
