# Airdrop recipients generator
This script allows creating a list of addresses for receiving impact market airdrop rewards

The receivers are extracted from the following categories:
1. cUSD doners to any of the impact market communities
2. CELO doners to any of the impact market communities
2. CELO token holders
3. UBE token holders
4. MOO token holders
5. UBE swap users
6. MOO market users
7. Impact market community Managers
8. Impact market community Beneficiaries

# How to
Running the whole process can take some time (around an hour)

1. Use a mainnet archive node such as the `celo-archive-node-0` pod in 
the `celo-mainnet` namespace
  * Configure the gcloud CLI to get the cluster credentials, then port forward to localhost:
```bash
gcloud container clusters get-credentials web3-monitoring --zone us-central1-a --project celo-validators
kubectl config set-context --current --namespace celo-mainnet
kubectl port-forward -n celo-mainnet celo-archive-node-0 8545 8546
```
2. Install dependencies: `pip install -r requirements.txt`
3. Run the main script: `python airdrop_main.py`
4. TODO: determine the reward distribution and apply to the different categories of receivers
5. Create/deploy the reward distribution contract using the file from last step

