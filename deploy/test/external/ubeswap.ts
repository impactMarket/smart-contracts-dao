// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { ethers } from "hardhat";
//
// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
// 	const { deployments, ethers } = hre;
//
// 	const { deploy } = deployments;
//
// 	const accounts: SignerWithAddress[] = await ethers.getSigners();
// 	const deployer = accounts[0];
//
// 	const uniswapV2Factory = await deploy("UniswapV2Factory", {
// 		from: deployer.address,
// 		args: [deployer.address],
// 		log: true,
// 		// gasLimit: 13000000,
// 	});
//
// 	const uniswapV2Router02 = await deploy("UniswapV2Router02", {
// 		from: deployer.address,
// 		args: [uniswapV2Factory.address],
// 		log: true,
// 		// gasLimit: 13000000,
// 	});
// };
//
// func.tags = ["UbeswapTest"];
// export default func;
