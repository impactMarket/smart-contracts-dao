import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, getChainId } = hre;

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	const chainID = await getChainId();

	let cUSDToken =
		chainID === "44787"
			? "0x874069fa1eb16d44d622f2e0ca25eea172369bc1"
			: chainID === "62320"
			? "0x62492a644a588fd904270bed06ad52b9abfea1ae"
			: chainID === "42220"
			? "0x765de816845861e75a25fca122bb6898b8b1282a"
			: ZERO_ADDRESS;

	if (cUSDToken === ZERO_ADDRESS) {
		// If no real network specified, create our own cUSD Token
		const cUSDResult = await deploy("TokenMock", {
			from: deployer,
			args: ["cUSD", "cUSD"],
			log: true,
			// gasLimit: 13000000,
		});
		cUSDToken = cUSDResult.address;
	}

	const IPCTDelegator = await deployments.get("IPCTDelegator");
	const communityAdminResult = await deploy("CommunityAdmin", {
		from: deployer,
		args: [cUSDToken, IPCTDelegator.address], //edi: should be timelock address; first must set community factory
		log: true,
		// gasLimit: 13000000,
	});

	await deploy("CommunityFactory", {
		from: deployer,
		args: [cUSDToken, communityAdminResult.address],
		log: true,
		// gasLimit: 13000000,
	});
};

func.dependencies = ["Governance"];
func.tags = ["Community"];
export default func;
