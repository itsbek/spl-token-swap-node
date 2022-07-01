import {
  createTokenSwap,
  swap,
  depositAllTokenTypes,
  withdrawAllTokenTypes,
} from './swap';
import { CurveType, Numberu64 } from '@solana/spl-token-swap';

async function main() {
  console.log('createTokenSwap pool (constant product)');
  await createTokenSwap(CurveType.ConstantProduct);
  console.log('deposit all token types');
  await depositAllTokenTypes();
  console.log('withdraw all token types');
  await withdrawAllTokenTypes();
  console.log('swapping');
  await swap();
  console.log('Success\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());
