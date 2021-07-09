![workflow status](https://github.com/keyko-io/impact-market-token/workflows/Build/badge.svg)
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
| `/community/interfaces/ICommunityFactory.sol`| Interface for CommunityFactory.sol                                            |                                       |
| `/community/interfaces/IImpactMarket.sol`    | Interface for ImpactMarket.sol                                                |                                       |
| `/community/Community.sol`                   | A UBI community that is funded by Impact Labs which beneficiaries claim from  |                                       |
| `/community/CommunityFactory.sol`            | The factory contract that creates new Communities                             |                                       |
| `/community/ImpactMarket.sol`                | Community controller that orchestrates creation of new Communities            |                                       |
| `/governance/IPTCGovernor.sol`               | Contract that manages creation, execution, cancellation of proposals          |                                       |
| `/governance/Timelock.sol`                   | Timelock that marshalls the execution of governance proposals                 |                                       |
| `/token/IPCT.sol`                            | The Impact Markets cERC-20 token contract                                     |                                       |
| `/token/TokenDistributor.sol`                | Merkel Distributor for the Impact Markets token airgrab                       |                                       |
| `/token/TreasuryVester.sol`                  | Vesting contract for non-airgrab initial distribution of tokens               |                                       |
| `/community/Migrations.sol`                  | Truffle artifact only used during deployments                                 |                                       |
| `/test/Token.sol`                            | Sample cERC-20 token used in test only                                        |                                       |