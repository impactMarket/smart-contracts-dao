import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

//alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const communityAdminProxyAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";
// const communityTestAddress = '0xDFFCace49060DFdADF3e28A6125Bf67298F7c88A';

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const communityAdminProxyAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";
const communityTestAddress = '0xCDb4Fe1C54842Cd644aAb9249CE56D6a32E038bD';

let newCommunityImplementationAddress: string;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await deployNewCommunityImplementation();
	await createUpgradeImplementation();
};

async function deployNewCommunityImplementation() {
	console.log("Deploying new contract for Community");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	newCommunityImplementationAddress = (
		await deploy('CommunityImplementation', {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function createUpgradeImplementation() {
	console.log("Creating new proposal");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		governanceDelegatorAddress,
		deployer,
		[
			communityAdminProxyAddress,
			communityTestAddress
		],
		[0, 0],
		[
			"updateCommunityImplementation(address)",
			"impactMarketAddress()"  //used just for testing
		],
		[
			["address"],
			[]
		],
		[
			[newCommunityImplementationAddress],
			[]
		],
		'Upgrade CommunityImplementation'
	);
}

export default func;
func.tags = ["Community_upgrade"];
