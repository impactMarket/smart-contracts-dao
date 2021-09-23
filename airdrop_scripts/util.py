import json
import os

from web3 import WebsocketProvider

from airdrop_scripts.http_provider import CustomHTTPProvider
from airdrop_scripts.web3_instance import get_web3

ENV_INFURA_CONNECTION_TYPE = "INFURA_CONNECTION_TYPE"
ENV_INFURA_PROJECT_ID = "INFURA_PROJECT_ID"
ENV_WEB3_NETWORK = "WEB3_NETWORK"
IMPACT_MARKET_START_BLOCK = "IMPACT_MARKET_START_BLOCK"
TARGET_BLOCK = "TARGET_BLOCK"

WEB3_INFURA_PROJECT_ID = "357f2fe737db4304bd2f7285c5602d0d"
GANACHE_URL = "http://127.0.0.1:8545"

# shortcut names for networks that *Infura* supports, plus ganache
SUPPORTED_NETWORK_NAMES = {"rinkeby", "kovan", "ganache", "mainnet", "ropsten"}


def get_start_block():
    return os.getenv(IMPACT_MARKET_START_BLOCK, 0)


def get_target_block():
    return os.getenv(TARGET_BLOCK, None)


def get_web3_network():
    return os.getenv(ENV_WEB3_NETWORK, "mainnet")


def get_web3_connection_provider(network_url):
    """Return the suitable web3 provider based on the network_url.

    When connecting to a public ethereum network (mainnet or a test net) without
    running a local node requires going through some gateway such as `infura`.

    Using infura has some issues if your code is relying on evm events.
    To use events with an infura connection you have to use the websocket interface.

    Make sure the `infura` url for websocket connection has the following format
    wss://rinkeby.infura.io/ws/v3/357f2fe737db4304bd2f7285c5602d0d
    Note the `/ws/` in the middle and the `wss` protocol in the beginning.

    A note about using the `rinkeby` testnet:
        Web3 py has an issue when making some requests to `rinkeby`
        - the issue is described here: https://github.com/ethereum/web3.py/issues/549
        - and the fix is here: https://web3py.readthedocs.io/en/latest/middleware.html#geth-style-proof-of-authority

    :param network_url: str
    :return: provider : HTTPProvider
    """
    if network_url == "ganache":
        network_url = GANACHE_URL

    if network_url.startswith("http"):
        provider = CustomHTTPProvider(network_url)

    else:
        if network_url.startswith("http"):
            provider = CustomHTTPProvider(network_url)
        else:
            provider = WebsocketProvider(network_url)

    return provider


def to_base_18(amt: float) -> int:
    return to_base(amt, 18)


def to_base(amt: float, dec: int) -> int:
    """Returns value in e.g. wei (taking e.g. ETH as input)."""
    return int(amt * 1 * 10 ** dec)


def from_base_18(num_base: int) -> float:
    return from_base(num_base, 18)


def from_base(num_base: int, dec: int) -> float:
    """Returns value in e.g. ETH (taking e.g. wei as input)."""
    return float(num_base / (10 ** dec))


def load_contract(filename, address):
    with open(filename) as f:
        contract_definition = json.loads(f.read())

        if not address and "address" in contract_definition:
            address = contract_definition.get("address")
            assert address, "Cannot find contract address in the abi file."
            address = get_web3().toChecksumAddress(address)
        assert address is not None, "address shouldn't be None at this point"

        if isinstance(contract_definition, dict):
            abi = contract_definition["abi"]
        elif isinstance(contract_definition, list):
            abi = contract_definition
        else:
            raise AssertionError(f'Unrecognized abi file content of type {type(contract_definition)}.')

        bytecode = contract_definition["bytecode"]
        contract = get_web3().eth.contract(
            address=address, abi=abi, bytecode=bytecode
        )
        if contract.address is None:  # if web3 drops address, fix it
            contract.address = address
        assert contract.address is not None
        return contract


def read_abi_from_file(contract_name, abi_path):
    path = None
    contract_name = contract_name + ".json"
    names = os.listdir(abi_path)
    # :HACK: temporary workaround to handle an extra folder that contain the artifact files.
    if len(names) == 1 and names[0] == "*":
        abi_path = os.path.join(abi_path, "*")

    for name in os.listdir(abi_path):
        if name.lower() == contract_name.lower():
            path = os.path.join(abi_path, contract_name)
            break

    if path:
        with open(path) as f:
            return json.loads(f.read())

    return None


def get_block_steps(from_block, to_block, step_size=300000):
    assert step_size > 0
    assert to_block > from_block, ''
    nblocks = to_block - from_block + 1
    if step_size >= nblocks:
        return nblocks

    n = int(nblocks / step_size)
    step = step_size if n >= 2 else int(nblocks / 2)
    steps = list(range(from_block, to_block, step))
    if to_block != steps[-1]:
        steps.append(to_block)
    return steps
