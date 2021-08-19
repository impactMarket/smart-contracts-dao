import { task } from "hardhat/config";
import "solidity-coverage";
import "hardhat-docgen";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

const CELO_DERIVATION_PATH = "m/44'/52752'/0'/0/";
function getMnemonic(network:string) : string {
	require("dotenv").config({ path: `.env.${network}` });
	return process.env.MNEMONIC || '';
};

export default {
  networks: {
    hardhat: {
      hardfork: "istanbul",
      allowUnlimitedContractSize: true,
      gasPrice: "auto",
			gas: 13000000,
    },
    alfajores: {
      chainId: 44787,
      url: "https://alfajores-forno.celo-testnet.org",
      hardfork: "istanbul",
      accounts: {
        mnemonic: getMnemonic("alfajores"),
        path: CELO_DERIVATION_PATH,
      },
      allowUnlimitedContractSize: true,
      gas: "auto",
      gasPrice: "auto",
      blockGasLimit: 13000000,
    },
    baklava: {
      chainId: 62320,
      url: "https://baklava-forno.celo-testnet.org",
      hardfork: "istanbul",
      accounts: {
        mnemonic: getMnemonic("baklava"),
        path: CELO_DERIVATION_PATH,
      },
      allowUnlimitedContractSize: true,
      gasPrice: "auto",
			gas: "auto",
      blockGasLimit: 13000000,
    },
    mainnet: {
      chainId: 42220,
      url: "https://forno.celo.org",
      hardfork: "istanbul",
      accounts: {
        mnemonic: getMnemonic("mainnet"),
        path: CELO_DERIVATION_PATH,
      },
      allowUnlimitedContractSize: true,
      gasPrice: "auto",
			gas: "auto",
      blockGasLimit: 13000000,  
    }
  },
  solidity: "0.8.5",
  namedAccounts: {
    deployer: {
      default: 0
    },
    user1: {
      default: 1
    },
    user2: {
      default: 2
    },
    user3: {
      default: 3
    }
  }
  // docgen: {
  //   path: './docs',
  //   clear: true,
  //   runOnCompile: true,
  // }
};
