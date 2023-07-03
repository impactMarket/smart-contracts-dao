//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./interfaces/AirdropV3StorageV1.sol";

contract AirdropV3Implementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    AirdropV3StorageV1
{
    address public constant override VIRTUAL_TOKEN_ADDRESS =
        0x00000000000000000000000000000000000000A3;

    /**
     * @notice Triggered after a claim
     *
     * @param beneficiary         The address of the beneficiary that has claimed
     * @param community           The address of the beneficiary's community
     * @param amount              The amount to be registered as donation
     */
    event Registered(address indexed beneficiary, address indexed community, uint256 amount);

    /**
     * @notice Used to initialize a new Airdrop contract
     *
     * @param _donationMiner         The address of the DonationMiner
     * @param _socialConnectAddress  The address of the socialConnect contract
     * @param _socialConnectIssuer   The address of impactMarket issuer
     * @param _amount                The amount to be registered as donation
     */
    function initialize(
        address _donationMiner,
        address _socialConnectAddress,
        address _socialConnectIssuer,
        uint256 _amount
    ) public initializer {
        __Ownable_init();
        __Pausable_init();

        donationMiner = IDonationMiner(_donationMiner);
        socialConnect = ISocialConnect(_socialConnectAddress);
        socialConnectIssuer = _socialConnectIssuer;
        amount = _amount;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Updates the amount value
     *
     * @param _newAmount    the new amount value
     */
    function updateAmount(uint256 _newAmount) external override onlyOwner {
        amount = _newAmount;
    }

    /**
     * @notice Register new beneficiaries
     *
     * @param _beneficiaryAddresses    the addresses of the beneficiaries
     * @param _communityAddresses      the addresses of the beneficiaries communities
     */
    function register(address[] memory _beneficiaryAddresses, address[] memory _communityAddresses)
        external
        override
    {
        uint256 _length = _beneficiaryAddresses.length;
        require(_length == _communityAddresses.length, "AirdropV3: Invalid data");

        ICommunity.BeneficiaryState _state;

        for (uint256 _index; _index < _length; _index++) {
            Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddresses[_index]];

            require(_beneficiary.amount == 0, "AirdropV3: Beneficiary already registered");

            require(
                donationMiner.treasury().communityAdmin().communities(
                    _communityAddresses[_index]
                ) == ICommunityAdmin.CommunityState.Valid,
                "AirdropV3: Invalid community"
            );

            (_state, , , ) = ICommunity(_communityAddresses[_index]).beneficiaries(
                _beneficiaryAddresses[_index]
            );
            require(
                _state == ICommunity.BeneficiaryState.Valid,
                "AirdropV3: Invalid beneficiary - community pair"
            );

            require(
                _isSocialConnectVerified(_beneficiaryAddresses[_index]),
                "AirdropV3: User has not been verified"
            );

            _beneficiary.amount = amount;

            donationMiner.donateVirtual(
                IERC20(VIRTUAL_TOKEN_ADDRESS),
                amount,
                _beneficiaryAddresses[_index]
            );

            emit Registered(_beneficiaryAddresses[_index], _communityAddresses[_index], amount);
        }
    }

    function _isSocialConnectVerified(address _userAddress) internal view returns (bool) {
        address[] memory _issuers = new address[](1);
        _issuers[0] = address(socialConnectIssuer);
        (uint256[] memory _countsPerIssuer, ) = socialConnect.lookupIdentifiers(
            _userAddress,
            _issuers
        );

        return _countsPerIssuer[0] > 0;
    }
}
