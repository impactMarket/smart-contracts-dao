//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "../../treasuryLpSwap/interfaces/ITreasuryLpSwap.sol";
import "../../donationMiner/interfaces/IDonationMiner.sol";

interface ITreasury {
    enum LpStrategy {     //strategy to use for splitting the LP fees between treasury and buyback
        NONE,             //all funds remains into treasury
        MainCoin,         //for UBI coins (like cUSD): UBI coin fees are kept in treasury, PACT fees are used for buyback
        SecondaryCoin     //for non UBI coins (like cEUR): half of the fees are swapped to PACT and used for buyback,
                          // half of the fees are swapped to cUSD and kept in treasury
                          // (PACT fees are used for buyback)
    }

    struct Token {
        uint256 rate;                          //rate of the token in CUSD
        LpStrategy lpStrategy;                 //strategy to use for splitting the LP fees between treasury and buyback
        uint256 lpPercentage;                  //percentage of the funds to be used for LP
        uint256 lpMinLimit;                    //minimum amount of funds that need to be in the treasury (and not to be used for LP)
        uint256 uniswapNFTPositionManagerId;   //id of the NFT position manager
        bytes exchangePathToCUSD;              //uniswap path to exchange the token to CUSD
        bytes exchangePathToPACT;              //uniswap path to exchange the token to PACT
    }

    function getVersion() external pure returns(uint256);
    function communityAdmin() external view returns(ICommunityAdmin);
    function lpSwap() external view returns(ITreasuryLpSwap);
    function PACT() external view returns (IERC20);
    function donationMiner() external view returns (IDonationMiner);
    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function updateLpSwap(ITreasuryLpSwap _lpSwap) external;
    function updatePACT(IERC20 _newPACT) external;
    function updateDonationMiner(IDonationMiner _newDonationMiner) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function isToken(address _tokenAddress) external view returns (bool);
    function tokenListLength() external view returns (uint256);
    function tokenListAt(uint256 _index) external view returns (address);
    function tokens(address _tokenAddress) external view returns (
        uint256 rate,
        LpStrategy lpStrategy,
        uint256 lpPercentage,
        uint256 lpMinLimit,
        uint256 uniswapNFTPositionManagerId,
        bytes calldata exchangePathToCUSD,
        bytes calldata exchangePathToPACT
    );
    function setToken(
        address _tokenAddress,
        uint256 _rate,
        LpStrategy _lpStrategy,
        uint256 _lpPercentage,
        uint256 _lpMinLimit,
        uint256 _uniswapNFTPositionManagerId,
        bytes memory _exchangePathToCUSD,
        bytes memory _exchangePathToPACT
    ) external;
    function removeToken(address _tokenAddress) external;
    function getConvertedAmount(address _tokenAddress, uint256 _amount) external returns (uint256);
    function convertAmount(
        address _tokenAddress,
        uint256 _amountIn,
        uint256 _amountOutMin,
        bytes memory _exchangePath
    ) external;
    function useFundsForLP() external;
    function collectFees(uint256 _uniswapNFTPositionManagerId) external;
}
