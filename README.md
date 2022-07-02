# SPL Token Swap Node

Simply put: it's a client without UI. It creates a pool, tokens and swaps them. 

This project is under development and wasn't audited nor tested, and developed solely for educational purposes!

## Getting started

install dependencies

```yarn```

or 

```npm install```

I had to run solana test validator since it is targetting directly `solana-sdk` for testing on localhost/localnet(skip this if you're testing on `devnet` or `testnet`). start the following command on a separate terminal:

```solana-test-validator```

start the nodemon run:
```yarn run dev```
## Features

- [x]  creating pool mint
- [x]  creating pool account
- [x]  creating token A
- [x]  creating token A account
- [x]  creating token B
- [x]  creating token B account
- [x]  minting token B to swap
- [x]  creating token swap
- [x]  loading token swap
- [x]  swap tokens 




## Docs Used  
- [Solana Program Library](https://spl.solana.com/token-swap)
 - [SPL Repo](https://github.com/solana-labs/solana-program-library/tree/master/token-swap)
 - [Token Swap Repo](https://github.com/solana-labs/solana-program-library/tree/master/token-swap)
