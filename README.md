![workflow status](https://github.com/keyko-io/impact-market-token/workflows/Build/badge.svg)
[![MythXBadge](https://badgen.net/https/api.mythx.io/v1/projects/0b74321a-7ca9-4979-a4d1-ab7211fcc1c3/badge/data?cache=300&icon=https://raw.githubusercontent.com/ConsenSys/mythx-github-badge/main/logo_white.svg)](https://docs.mythx.io/dashboard/github-badges)
# impact-market-token
Token and governance for Impact Market
## Install
```
nvm use 12
yarn --ignore-engines
``` 
## Build / Test / Deploy
`yarn build` / `yarn coverage` / `yarn deploy`
## Documentation
* Generate with `yarn docgen`
* Navigable HTML documentation from `./docs/index.html`

# Contracts

| Contract                                     | Purpose                                                                       | Source
|----------------------------------------------|-------------------------------------------------------------------------------| ------------------------------------- |
| `/community/interfaces/ICommunity.sol`       | Interface for Community.sol                                                   |                                       |
| `/community/interfaces/ICommunityAdmin.sol`  | Interface for CommunityAdminImplementation.sol                                |                                       |
| `/community/Community.sol`                   | A UBI community that is funded by Impact Labs which beneficiaries claim from  |                                       |
| `/community/CommunityAdminImplementation.sol`| Community controller that orchestrates creation of new Communities            |                                       |
| `/governance/IPTCGovernor.sol`               | Contract that manages creation, execution, cancellation of proposals          |                                       |
| `/governance/Timelock.sol`                   | Timelock that marshalls the execution of governance proposals                 |                                       |
| `/token/IPCT.sol`                            | The Impact Markets cERC-20 token contract                                     |                                       |
| `/token/DonationMinerImplementation.sol`     | Vesting contract for non-airgrab initial distribution of tokens               |                                       |
| `/token/TreasuryImplementation.sol`          | Contract that manages the funds                                               |                                       |
| `/airgrab/MerkleDistributor.sol`             | Merkle Distributor for the Impact Markets token airgrab                       |                                       |
| `/test/Token.sol`                            | Sample cERC-20 token used in test only                                        |                                       |
