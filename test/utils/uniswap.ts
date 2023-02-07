import * as ethersTypes from "ethers";
import { BigNumber } from "ethers";
import bn from "bignumber.js";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {fromEther, toEther} from "./helpers";
const NFTPositionManagerABI =
	require("../../util/abi/uniswap/periphery/NonfungiblePositionManager.json").abi;

export const uniswapRouterAddress =
	"0x5615CDAb10dc425a742d643d949a7F474C01abc4";
export const uniswapQuoterAddress =
	"0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8";
export const uniswapNFTPositionManagerAddress =
	"0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A";

export async function createPool(
	owner: SignerWithAddress,
	token0: ethersTypes.Contract,
	token1: ethersTypes.Contract,
	amount0: BigNumber,
	amount1: BigNumber
) {
	const NFTPositionManager = await ethers.getContractAt(
		NFTPositionManagerABI,
		uniswapNFTPositionManagerAddress
	);

	await token0.connect(owner).approve(NFTPositionManager.address, amount0);
	await token1.connect(owner).approve(NFTPositionManager.address, amount1);

	if (token0.address > token1.address) {
		const token0Copy = token0;
		token0 = token1;
		token1 = token0Copy;

		const amount0Copy = amount0;
		amount0 = amount1;
		amount1 = amount0Copy;
	}

	await NFTPositionManager.connect(owner).createAndInitializePoolIfNecessary(
		token0.address,
		token1.address,
		10000,
		encodePriceSqrt(amount0, amount1),
		// '2505290050365003892876723467', //encodePriceSqrt(BigNumber.from(1), BigNumber.from(1000)),   //price
		{ gasLimit: 5000000 }
	);

	await NFTPositionManager.connect(owner).mint({
		token0: token0.address,
		token1: token1.address,
		fee: 10000,
		tickLower: -887200,
		tickUpper: 887200,
		amount0Desired: amount0,
		amount1Desired: amount1,
		amount0Min: 0, //don't let it 0 into production
		amount1Min: 0, //don't let it 0 into production
		recipient: owner.address,
		deadline: 1773341392,
	});

	console.log('createPool 5')

}

export function getExchangePath(
	token0: ethersTypes.Contract,
	token1: ethersTypes.Contract,
	token2?: ethersTypes.Contract
) {
	if (token2) {
		return ethers.utils.solidityPack(
			["address", "uint24", "address", "uint24", "address"],
			[token0.address, 10000, token1.address, 10000, token2.address]
		);
	} else {
		return ethers.utils.solidityPack(
			["address", "uint24", "address"],
			[token0.address, 10000, token1.address]
		);
	}
}

// returns the sqrt price as a 64x96
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });
function encodePriceSqrt(reserve0: BigNumber, reserve1: BigNumber): BigNumber {
	return BigNumber.from(
		new bn(reserve1.toString())
			.div(reserve0.toString())
			.sqrt()
			.multipliedBy(new bn(2).pow(96))
			.integerValue(3)
			.toString()
	);
}
