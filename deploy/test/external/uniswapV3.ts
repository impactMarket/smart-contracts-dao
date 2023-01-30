// import {HardhatRuntimeEnvironment} from "hardhat/types";
// import {DeployFunction} from "hardhat-deploy/types";
// import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
// import {deployments, ethers, getChainId} from "hardhat";
// import {BigNumber, BigNumberish, ContractFactory} from "ethers";
// import bn from 'bignumber.js'
// // @ts-ignore
// import WETH9 from "../../../util/abi/WETH9.json";
// import {toEther} from "../../../test/utils/helpers";
// import {computePoolAddress, FeeAmount, NonfungiblePositionManager, Pool, Position} from "@uniswap/v3-sdk";
// import {BigintIsh, Percent, Token} from "@uniswap/sdk-core";
// import {TickDataProvider} from "@uniswap/v3-sdk/dist/entities/tickDataProvider";
// import {Tick, TickConstructorArgs} from "@uniswap/v3-sdk/dist/entities/tick";
//
// type ContractJson = { abi: any; bytecode: string };
// const artifacts: { [name: string]: ContractJson } = {
// 	UniswapV3Pool: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),
// 	UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
// 	SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
// 	NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
// 	NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
// 	NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
// 	WETH9
// };
//
// const linkLibraries = (
// 	{
// 		bytecode,
// 		linkReferences,
// 	}: {
// 		bytecode: string
// 		linkReferences: {
// 			[fileName: string]: {
// 				[contractName: string]: { length: number; start: number }[]
// 			}
// 		}
// 	},
// 	libraries: { [libraryName: string]: string }
// ): string => {
// 	Object.keys(linkReferences).forEach((fileName) => {
// 		Object.keys(linkReferences[fileName]).forEach((contractName) => {
// 			if (!libraries.hasOwnProperty(contractName)) {
// 				throw new Error(`Missing link library name ${contractName}`)
// 			}
// 			const address = ethers.utils
// 				.getAddress(libraries[contractName])
// 				.toLowerCase()
// 				.slice(2)
// 			linkReferences[fileName][contractName].forEach(
// 				({ start: byteStart, length: byteLength }) => {
// 					const start = 2 + byteStart * 2
// 					const length = byteLength * 2
// 					bytecode = bytecode
// 						.slice(0, start)
// 						.concat(address)
// 						.concat(bytecode.slice(start + length, bytecode.length))
// 				}
// 			)
// 		})
// 	})
// 	return bytecode
// }
//
// bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })
//
// // returns the sqrt price as a 64x96
// export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
// 	return BigNumber.from(
// 		new bn(reserve1.toString())
// 			.div(reserve0.toString())
// 			.sqrt()
// 			.multipliedBy(new bn(2).pow(96))
// 			.integerValue(3)
// 			.toString()
// 	)
// }
//
// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
// 	// @ts-ignore
// 	const { deployments, ethers } = hre;
// 	const { deploy } = deployments;
//
// 	const accounts: SignerWithAddress[] = await ethers.getSigners();
// 	const deployer = accounts[0];
//
// 	const tokenFactory = await ethers.getContractFactory("TokenMock");
// 	const celo2 = await tokenFactory.deploy("celo", "CELO");
// 	const cUSD = await tokenFactory.deploy("mUSD", "mUSD");
// 	const pact = await tokenFactory.deploy("PACT", "Impact");
//
// 	const WETH9 = new ContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, deployer)
// 	const weth = await WETH9.deploy();
//
// 	const UniswapV3Factory = new ContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, deployer)
// 	const uniswapV3Factory = await UniswapV3Factory.deploy();
// 	// const uniswapV3Factory = await (await ethers.getContractFactory("UniswapV3Factory")).deploy();
// 	console.log('uniswapV3Factory: ', uniswapV3Factory.address);
//
//
// 	const SwapRouter = new ContractFactory(artifacts.SwapRouter.abi, artifacts.SwapRouter.bytecode, deployer)
// 	const swapRouter = await SwapRouter.deploy(uniswapV3Factory.address, weth.address);
// 	// const swapRouter = await (await ethers.getContractFactory("SwapRouter")).deploy(uniswapV3Factory.address, '0x0000000000000000000000000000000000000000');
// 	console.log('swapRouter: ', swapRouter.address);
//
//
// 	const NFTDescriptor = new ContractFactory(artifacts.NFTDescriptor.abi, artifacts.NFTDescriptor.bytecode, deployer)
// 	const nftDescriptor = await NFTDescriptor.deploy();
// 	// const nftDescriptor = await (await ethers.getContractFactory("NFTDescriptor")).deploy();
// 	console.log('nftDescriptor: ', nftDescriptor.address);
//
//
// 	const linkedBytecode = linkLibraries(
// 		{
// 			bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
// 			linkReferences: {
// 				"NFTDescriptor.sol": {
// 					NFTDescriptor: [
// 						{
// 							length: 20,
// 							start: 1261,
// 						},
// 					],
// 				},
// 			},
// 		},
// 		{
// 			NFTDescriptor: nftDescriptor.address,
// 		}
// 	);
//
// 	const NonfungibleTokenPositionDescriptor = new ContractFactory(artifacts.NonfungibleTokenPositionDescriptor.abi, linkedBytecode, deployer)
// 	const nftTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deploy(weth.address);
// 	// const nftTokenPositionDescriptor = await (await ethers.getContractFactory(
// 	// 	"NonfungibleTokenPositionDescriptor",
// 	// 	{
// 	// 		libraries: {
// 	// 			NFTDescriptor: nftDescriptor.address,
// 	// 		}
// 	// 	}
// 	// )).deploy('0x0000000000000000000000000000000000000000', '0x43454c4f00000000000000000000000000000000000000000000000000000000');
// 	console.log('nftTokenPositionDescriptor: ', nftTokenPositionDescriptor.address);
//
//
//
// 	const NonfungiblePositionManager = new ContractFactory(artifacts.NonfungiblePositionManager.abi, artifacts.NonfungiblePositionManager.bytecode, deployer)
// 	const nftPositionManager = await NonfungiblePositionManager.deploy(uniswapV3Factory.address, weth.address, nftTokenPositionDescriptor.address);
// 	// const nftPositionManager = await (await ethers.getContractFactory("NonfungiblePositionManager"))
// 	// 	.deploy(uniswapV3Factory.address, '0x0000000000000000000000000000000000000000', nftTokenPositionDescriptor.address);
// 	console.log('nftPositionManager: ', nftPositionManager.address);
//
//
// 	console.log('111111');
//
// 	await nftPositionManager.connect(deployer).createAndInitializePoolIfNecessary(
// 		pact.address,
// 		cUSD.address,
// 		10000,
// 		encodePriceSqrt(1, 1000),   //price
// 		{gasLimit: 5000000}
// 	);
// 	console.log('nftPositionManager: ', nftPositionManager.address);
//
//
//
// 	//sdk style
// 	await cUSD.approve(nftPositionManager.address, toEther(1000000));
// 	await pact.approve(nftPositionManager.address, toEther(1000000));
// 	console.log('cUSD: ', cUSD.address);
// 	console.log('pact: ', pact.address);
//
//
// 	// const chainId = Number(await getChainId());
// 	//
// 	// console.log(chainId);
// 	// const cUSDToken = new Token(chainId, cUSD.address, 18);
// 	// const pactToken = new Token(chainId, pact.address, 18);
// 	// const currentPoolAddress = computePoolAddress({
// 	// 	factoryAddress: uniswapV3Factory.address,
// 	// 	tokenA: pactToken,
// 	// 	tokenB: cUSDToken,
// 	// 	fee: FeeAmount.HIGH,
// 	// });
// 	//
// 	// console.log('currentPoolAddress: ', currentPoolAddress)
//
//
//
//
//
// 	console.log('333333333');
//
//
// 	const poolAddress = await uniswapV3Factory.getPool(
// 		pact.address,
// 		cUSD.address,
// 		10000,
// 	);
// 	console.log('poolAddress', poolAddress);
//
//
// 	const pool = await ethers.getContractAt('UniswapV3Pool', poolAddress);
//
//
// 	await nftPositionManager.mint({
// 		token1: cUSD.address,
// 		token0: pact.address,
// 		fee: 10000,
// 		tickLower: -887200,
// 		tickUpper: 887200,
// 		amount0Desired: '1000099338977258830165',
// 		amount1Desired: '1000000000000000000',
// 		amount0Min: '997608427664887969944',
// 		amount1Min: '997496867163000167',
// 		recipient: deployer.address,
// 		deadline: 1773341392
// 	});
//
// 	console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
//
// 	console.log('asdasdasd: ', await nftPositionManager.positions(1));
//
//
// 	// constructor(tokenA: Token, tokenB: Token, fee: FeeAmount, sqrtRatioX96: BigintIsh, liquidity: BigintIsh, tickCurrent: number, ticks?: TickDataProvider | (Tick | TickConstructorArgs)[]);
// 	// const poolSDK  = new Pool(
// 	// 		pactToken,
// 	// 		cUSDToken,
// 	// 		FeeAmount.HIGH,
// 	// 		encodePriceSqrt(1, 10),
// 	// 		BigintIsh,
// 	// 		number,
// 	// 		ticks?: TickDataProvider | (Tick | TickConstructorArgs
// 	// );
// 	//
// 	// const mintOptions: MintOptions = {
// 	// 	recipient: deployer.address,
// 	// 	deadline: Math.floor(Date.now() / 1000) + 60 * 20,
// 	// 	slippageTolerance: new Percent(50, 10_000),
// 	// }
// 	//
// 	// const position = Position.fromAmounts(
// 	// 	pool: configuredPool,
// 	// 	tickLower:
// 	// nearestUsableTick(poolInfo.tick, poolInfo.tickSpacing) -
// 	// poolInfo.tickSpacing * 2,
// 	// 	tickUpper:
// 	// nearestUsableTick(poolInfo.tick, poolInfo.tickSpacing) +
// 	// poolInfo.tickSpacing * 2,
// 	// 	amount0: token0Amount.quotient,
// 	// 	amount1: token1Amount.quotient,
// 	// 	useFullPrecision: true,
// 	// );
// 	//
// 	// NonfungiblePositionManager.addCallParameters();
// };
//
// export default func;
// func.tags = ["UniswapV3Test"];
