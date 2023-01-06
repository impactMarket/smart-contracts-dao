![workflow status](https://github.com/impactMarket/impact-market-smart-contracts/workflows/Build/badge.svg)
[![MythXBadge](https://badgen.net/https/api.mythx.io/v1/projects/0b74321a-7ca9-4979-a4d1-ab7211fcc1c3/badge/data?cache=300&icon=https://raw.githubusercontent.com/ConsenSys/mythx-github-badge/main/logo_white.svg)](https://docs.mythx.io/dashboard/github-badges)

# impact-market-smart-contracts

Solidity smart-contracts for impactMarket protocol

## Install

```
$ nvm use
$ yarn
``` 

## Build / Test / Deploy

```
$ yarn build
$ yarn coverage
$ yarn deploy
$ yarn test
```

## Documentation

* Generate with `yarn docgen`
* Navigable HTML documentation from `./docs/index.html`

# Contracts

| Contract                                                              | Purpose                                                                      | Address
|-----------------------------------------------------------------------|------------------------------------------------------------------------------|---------------------------------------------|
| `/airgrab/MerkleDistributor.sol`                                      | Merkle Distributor for the initial token airgrab                             | 0xd2b20e06C19e7b7E7E385b0F1386Cdde8C6dCd2B  |
| `/community/CommunityImplementation.sol`                              | A UBI community that is funded by Impact Labs which beneficiaries claim from | 0xEc94c60f17F7f262973f032965534D1137f1202c  |
| `/community/CommunityMiddleProxy.sol`                                 | CommunityMiddleProxy                                                         | 0xe8037e4ceEd80EC6D02f482a5A35E0011245FCDC  |
| `/community/CommunityAdminProxy.sol`                                  | Proxy contract that orchestrates creation of new Communities                 | 0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9  |
| `/community/CommunityAdminImplementation.sol`                         | Implementation for the CommunityAdminProxy                                   | 0xFD63395526ef820C5E2A379a36cD578E419b1a71  |
| `/governance/ImpactProxyAdmin.sol`                                    | Contract that is in charge of all the proxies                                | 0xFC641CE792c242EACcD545B7bee2028f187f61EC  |
| `/governance/PACTDelegator.sol`                                       | Proxy contract that manages creation, execution, cancellation of proposals   | 0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4  |
| `/governance/PACTDelegate.sol`                                        | Implementation for the PACTDelegate                                          | 0xAeEd98C1c5C268C3E23672166Ea0Bde908C90624  |
| `/governance/PACTTimelock.sol`                                        | Timelock that marshalls the execution of governance proposals                | 0xca3171A5FCda4D840Aa375E907b7A1162aDA9379  |
| `/token/DonationMinerProxy.sol`                                       | Proxy vesting contract for non-airgrab distribution of tokens                | 0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593  |
| `/token/DonationMinerImplementation.sol`                              | Implementation for DonationMinerImplementation                               | 0x140a654F9BF6Fe736F6e69Ae81377606c43214dF  |
| `/token/ImpactLabsProxy.sol`                                          | Vesting contract for ImpactLabs distribution of tokens                       | 0x767DA1d208DDA5bc517dcd4ba2A83591D68A5535  |
| `/token/ImpactLabsImplementation.sol`                                 | Implementation for ImpactLabsProxy                                           | 0x194f6811Ac5F2FaC8c02eAfBd70567c8597C1B69  |
| `/token/PACTToken.sol`                                                | The Impact Markets cERC-20 token contract                                    | 0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58  |
| `/token/TreasuryProxy.sol`                                            | Contract that manages the funds                                              | 0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6  |
| `/token/TreasuryImplementation.sol`                                   | Implementation for TreasuryProxy                                             | 0x5095C3DC6d89151f79433D84e596fD75EEFa10BB  |
| `/staking/StakingProxy.sol`                                           | Contract that manages the staking                                            | 0x1751e740379FC08b7f0eF6d49183fc0931Bd8179  |
| `/staking/StakingImplementation.sol`                                  | Implementation for StakingProxy                                              | 0x6e6b29711A6544cf928708EE0FAA1021FC0DBbEc  |
| `/governor/impactMarketCouncil/ImpactMarketCouncilProxy.sol`          | ImpactMarketCouncilProxy                                                     | 0xF2CA11DA5c3668DD48774f3Ce8ac09aFDc24aF3E  |
| `/governor/impactMarketCouncil/ImpactMarketCouncilImplementation.sol` | Implementation for ImpactMarketCouncilProxy                                  | 0x05483De7fE073DdB6f1Dddd7661d4136Af8Af99a  |
| `/ambassadors/AmbassadorsProxy.sol`                                   | AmbassadorsProxy                                                             | 0x25f58d8C2522dC7E0C53cF8163C837De2415Ba51  |
| `/ambassadors/AmbassadorsImplementation.sol`                          | Implementation for AmbassadorsProxy                                          | 0x3d150B0f44DaE282D4E5751DD7B8ABE297CD0d49  |
| `/airdropV2/AirdropV2Proxy.sol`                                       | AirdropV2Proxy                                                               | 0x482E748D452e6ECD86D58E597B673C5E653dAbe9  |
| `/airdropV2/AirdropV2Implementation.sol`                              | Implementation for AirdropV2Proxy                                            | 0x72b957fb8F6F25cA6d0a49b0Eb49771Ee16757E6  |
| `/learnAndEarn/LearnAndEarnProxy.sol`                                 | LearnAndEarnProxy                                                            | 0x496F7De1420ad52659e257C7Aa3f79a995274dbc  |
| `/learnAndEarn/LearnAndEarnImplementation.sol`                        | Implementation for LearnAndEarnProxy                                         | 0xF01a6816902eC89D8adb9cbD85f4b995756bcF4A  |
