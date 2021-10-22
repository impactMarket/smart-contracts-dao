# Impact Market Airdrop requirements
1. Script to output a CSV of addresses and airdrop amount for participants on the Celo network, snapshotted at a certain block number
  * Past donors to any Impact Markets community contract
  * Past community managers of any Impact Markets community contract
  * Past beneficiaries of any Impact Markets community contract
  * CELO holders (with a 1 CELO minimum holding)
  * Ubeswap users
  * UBE holders
  * Moola Markets users
  * MOO holders
1. 10% of 10 Billion IPCT tokens to be given to airdrop recipients, so 1 Billion in total
  * Donors will receive a scaled amount based on their donation amount (7%)
  * Others will receive a fixed amount per valid address (3%)
  * Leave these parameters adjustable so we can tweak the amounts to match 1 Billion
1. Feed CSV file into Merkel Distributor contract and deploy contract with the calculated merkle root and claim functions
  * Generate Merkel tree from https://github.com/celo-org/merkle-distributor working example
  * Deploy Merkel distributor contract with root calculated in previous step, Solidity code also available here: https://github.com/celo-org/merkle-distributor (I am checking in an updated version of this to https://github.com/keyko-io/impact-market-token)
  * Updated version will include the rule that after 1 year the unclaimed tokens can be withdrawn by the Impact Markets treasury to be utilised by the DAO
  * After sending tokens to the contract, recipients can then check their claim amount (Uniswap-style) against the contract and claim

## relevant information
@Samer Here are the contracts:
{
  impactMarket: '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca',
  communityFactory: '0xF3ba2c917b01627fb90673Aae0E170EE767Af8b6'
}

CommunityFactory creates Communities, there is only one factory

So we need every address that has donated CELO, cUSD to each Community (over 100 individual communities I believe). Both CELO and cUSD are regular ERC20's so you can use the Transfer event and filter on each Community address.

From the individual communities we also need to find:
All beneficiaries via the event BeneficiaryClaim(address indexed _account, uint256 _amount);  event
All managers via the event ManagerAdded(address indexed _account); event
(edited)

MOO holders (around 900 at moment)
UBE holders (around 3.3K at moment)
Maybe even all addresses that interacted with any Ube or Moola contracts (edited)


The existing impact markets code is here: https://github.com/impactMarket/smart-contracts/tree/master/contracts/ubi

@Samer @Eduard Dumea I've checked in a branch called /feature/airgrab which has an upgrade MerkleDistributor contract, upgraded to 8.5.0 and includes a new function for the treasury to withdraw the unclaimed funds after 1 year (17280 * 365 blocks)

Please use this branch for any scripts and so on

@Samer the token to distribute doesn't exist yet but we are creating it in the launch and will send it to the merkel distributor contract. Then in the Impact Markets front-end there will be a button to check and claim your airdrop, just like Uniswap



## NOTES
running a full node on celo mainnet (https://docs.celo.org/getting-started/mainnet/running-a-full-node-in-mainnet)
