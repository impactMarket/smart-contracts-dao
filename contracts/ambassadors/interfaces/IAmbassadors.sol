// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface IAmbassadors {
    function getVersion() external pure returns(uint256);
    function isAmbassador(address _ambassador) external view returns (bool);
    function isAmbassadorOf(address _ambassador, address _community) external view returns (bool);
    function isEntityOf(address _ambassador, address _entityAddress) external view returns (bool);
    function isAmbassadorAt(address _ambassador, address _entityAddress) external view returns (bool);

    function addEntity(address _entity) external;
    function removeEntity(address _entity) external;
    function replaceEntityAccount(address _entity, address _newEntity) external;
    function addAmbassador(address _ambassador) external;
    function removeAmbassador(address _ambassador) external;
    function replaceAmbassadorAccount(address _ambassador, address _newAmbassador) external;
    function replaceAmbassador(address _oldAmbassador, address _newAmbassador) external;
    function transferAmbassador(address _ambassador, address _toEntity, bool _keepCommunities) external;
    function transferCommunityToAmbassador(address _to, address _community) external;
    function setCommunityToAmbassador(address _ambassador, address _community) external;
    function removeCommunity(address _community) external;
}
