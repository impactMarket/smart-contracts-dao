//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract PACTTimelock {
    using SafeMath for uint256;

    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint256 indexed newDelay);
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    uint256 public constant GRACE_PERIOD = 14 days;
    uint256 public constant MINIMUM_DELAY = 1 hours;
    uint256 public constant MAXIMUM_DELAY = 30 days;

    address public admin;
    address public pendingAdmin;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;

    constructor(address _admin, uint256 _delay) {
        require(_delay >= MINIMUM_DELAY, "Timelock::constructor: Delay must exceed minimum delay.");
        require(
            _delay <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );

        admin = _admin;
        delay = _delay;
    }

    receive() external payable {}

    function setDelay(uint256 _delay) public {
        require(msg.sender == address(this), "Timelock::setDelay: Call must come from Timelock.");
        require(_delay >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(
            _delay <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );
        delay = _delay;

        emit NewDelay(delay);
    }

    function acceptAdmin() public {
        require(
            msg.sender == pendingAdmin,
            "Timelock::acceptAdmin: Call must come from pendingAdmin."
        );
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    function setPendingAdmin(address _pendingAdmin) public {
        require(
            msg.sender == address(this),
            "Timelock::setPendingAdmin: Call must come from Timelock."
        );
        pendingAdmin = _pendingAdmin;

        emit NewPendingAdmin(pendingAdmin);
    }

    function queueTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public returns (bytes32) {
        require(msg.sender == admin, "Timelock::queueTransaction: Call must come from admin.");
        require(
            _eta >= getBlockTimestamp().add(delay),
            "Timelock::queueTransaction: Estimated execution block must satisfy delay."
        );

        bytes32 _txHash = keccak256(abi.encode(_target, _value, _signature, _data, _eta));
        queuedTransactions[_txHash] = true;

        emit QueueTransaction(_txHash, _target, _value, _signature, _data, _eta);
        return _txHash;
    }

    function cancelTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public {
        require(msg.sender == admin, "Timelock::cancelTransaction: Call must come from admin.");

        bytes32 _txHash = keccak256(abi.encode(_target, _value, _signature, _data, _eta));
        queuedTransactions[_txHash] = false;

        emit CancelTransaction(_txHash, _target, _value, _signature, _data, _eta);
    }

    function executeTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public payable returns (bytes memory) {
        require(msg.sender == admin, "Timelock::executeTransaction: Call must come from admin.");

        bytes32 _txHash = keccak256(abi.encode(_target, _value, _signature, _data, _eta));
        require(
            queuedTransactions[_txHash],
            "Timelock::executeTransaction: Transaction hasn't been queued."
        );
        require(
            getBlockTimestamp() >= _eta,
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
        );
        require(
            getBlockTimestamp() <= _eta.add(GRACE_PERIOD),
            "Timelock::executeTransaction: Transaction is stale."
        );

        queuedTransactions[_txHash] = false;

        bytes memory _callData;

        if (bytes(_signature).length == 0) {
            _callData = _data;
        } else {
            _callData = abi.encodePacked(bytes4(keccak256(bytes(_signature))), _data);
        }

        // solium-disable-next-line security/no-call-value
        (bool _success, bytes memory _returnData) = _target.call{value: _value}(_callData);
        require(_success, "Timelock::executeTransaction: Transaction execution reverted.");

        emit ExecuteTransaction(_txHash, _target, _value, _signature, _data, _eta);

        return _returnData;
    }

    function getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
