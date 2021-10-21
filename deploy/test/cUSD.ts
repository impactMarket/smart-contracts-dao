import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

let cUSDAddress: string;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, getChainId } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	const chainID = await getChainId();

	switch (chainID) {
		case "44787": {
			cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";
			break;
		}
		case "62320": {
			cUSDAddress = "0x62492a644a588fd904270bed06ad52b9abfea1ae";
			break;
		}
		case "42220": {
			cUSDAddress = "0x765de816845861e75a25fca122bb6898b8b1282a";
			break;
		}
		default: {
			// If no real network specified, create our own cUSD Token
			const cUSDResult = await deploy("TokenMock", {
				from: deployer,
				args: ["cUSD", "cUSD"],
				log: true,
			});
			cUSDAddress = cUSDResult.address;
		}
	}
};

export function getCUSDAddress() {
	return cUSDAddress;
}
export default func;
func.tags = ["cUSDTest", "Test"];
