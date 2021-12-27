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

| Contract                                      | Purpose                                                                       | Address
|---------------------------------------------- |-------------------------------------------------------------------------------| ------------------------------------- |
| `/airgrab/MerkleDistributor.sol`              | Merkle Distributor for the initial token airgrab                              | 0xd2b20e06C19e7b7E7E385b0F1386Cdde8C6dCd2B |
| `/community/Community.sol`                    | A UBI community that is funded by Impact Labs which beneficiaries claim from  | 0x147b405e234F6E054876065629E34E4430E80aac |
| `/community/CommunityAdminProxy.sol`          | Proxy contract that orchestrates creation of new Communities                  | 0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9 |
| `/community/CommunityAdminImplementation.sol` | Implementation for the CommunityAdminProxy                                    | 0x7cA00e933C067C0Cf519D6043FCFFa82e8d4718F |
| `/governance/ImpactProxyAdmin.sol`            | Contract that is in charge of all the proxies                                 | 0xFC641CE792c242EACcD545B7bee2028f187f61EC |
| `/governance/PACTDelegator.sol`               | Proxy contract that manages creation, execution, cancellation of proposals    | 0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4 |
| `/governance/PACTDelegate.sol`                | Implementation for the PACTDelegate                                           | 0xAeEd98C1c5C268C3E23672166Ea0Bde908C90624 |
| `/governance/PACTTimelock.sol`                | Timelock that marshalls the execution of governance proposals                 | 0xca3171A5FCda4D840Aa375E907b7A1162aDA9379 |
| `/token/DonationMinerProxy.sol`               | Proxy vesting contract for non-airgrab distribution of tokens                 | 0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593 |
| `/token/DonationMinerImplementation.sol`      | Implementation for DonationMinerImplementation                                | 0x140a654F9BF6Fe736F6e69Ae81377606c43214dF |
| `/token/ImpactLabsProxy.sol`                  | Vesting contract for ImpactLabs distribution of tokens                        | 0x767DA1d208DDA5bc517dcd4ba2A83591D68A5535 |
| `/token/ImpactLabsImplementation.sol`         | Implementation for ImpactLabsProxy                                            | 0x194f6811Ac5F2FaC8c02eAfBd70567c8597C1B69 |
| `/token/PACTToken.sol`                        | The Impact Markets cERC-20 token contract                                     | 0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58 |
| `/token/TreasuryProxy.sol`                    | Contract that manages the funds                                               | 0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6 |
| `/token/TreasuryImplementation.sol`           | Implementation for TreasuryProxy                                              | 0x5095C3DC6d89151f79433D84e596fD75EEFa10BB |
