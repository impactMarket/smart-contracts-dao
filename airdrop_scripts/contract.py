
import logging
from typing import Any, Dict, Optional

import requests
from eth_typing import BlockIdentifier
from hexbytes import HexBytes
from web3 import Web3
from web3.contract import ConciseContract
from web3.exceptions import ValidationError
from web3.utils.events import get_event_data
from web3.utils.filters import construct_event_filter_params
from web3.utils.threads import Timeout
from websockets import ConnectionClosed

from util import load_contract
from web3_instance import get_web3

logger = logging.getLogger(__name__)


class Contract(object):

    def __init__(self, name: str, abi_path: str, address: str):
        """Initialises a Contract instance with both a regular Web3 Contract and a ConciseContract

        """
        self._contract_name = name
        assert abi_path, f"abi_path is required, got {abi_path}"

        self.contract = load_contract(abi_path, address)
        self.contract_concise = ConciseContract(self.contract)

        assert self.contract.address == address and self.address == address
        assert self.contract_concise is not None

    @property
    def contract_name(self) -> str:
        return self._contract_name

    @property
    def address(self) -> str:
        """Return the ethereum address of the solidity contract deployed in current network."""
        return self.contract.address

    @property
    def events(self):
        """
        Expose the underlying contract's events.

        :return:
        """
        return self.contract.events

    def get_event_signature(self, event_name):
        """
        Return signature of event definition to use in the call to eth_getLogs.

        The event signature is used as topic0 (first topic) in the eth_getLogs arguments
        The signature reflects the event name and argument types.

        :param event_name:
        :return:
        """
        e = getattr(self.events, event_name)
        if not e:
            raise ValueError(
                f"Event {event_name} not found in {self.contract_name} contract."
            )

        abi = e().abi
        types = [param["type"] for param in abi["inputs"]]
        sig_str = f'{event_name}({",".join(types)})'
        return Web3.sha3(text=sig_str).hex()

    @staticmethod
    def get_tx_receipt(tx_hash: str, timeout=20):
        """
        Get the receipt of a tx.

        :param tx_hash: hash of the transaction
        :param timeout: int in seconds to wait for transaction receipt
        :return: Tx receipt
        """
        try:
            get_web3().eth.waitForTransactionReceipt(
                tx_hash, timeout=timeout
            )
        except ValueError as e:
            logger.error(f"Waiting for transaction receipt failed: {e}")
            return None
        except Timeout as e:
            logger.info(f"Waiting for transaction receipt may have timed out: {e}.")
            return None
        except ConnectionClosed as e:
            logger.info(
                f"ConnectionClosed error waiting for transaction receipt failed: {e}."
            )
            raise
        except Exception as e:
            logger.info(f"Unknown error waiting for transaction receipt: {e}.")
            raise

        return get_web3().eth.getTransactionReceipt(tx_hash)

    def subscribe_to_event(
        self,
        event_name: str,
        timeout,
        event_filter,
        callback=None,
        timeout_callback=None,
        args=None,
        wait=False,
        from_block="latest",
        to_block="latest",
    ):
        """
        Create a listener for the event `event_name` on this contract.

        :param event_name: name of the event to subscribe, str
        :param timeout:
        :param event_filter:
        :param callback:
        :param timeout_callback:
        :param args:
        :param wait: if true block the listener until get the event, bool
        :param from_block: int or None
        :param to_block: int or None
        :return: event if blocking is True and an event is received, otherwise returns None
        """
        from .event_listener import EventListener

        return EventListener(
            getattr(self.events, event_name),
            event_name,
            args,
            filters=event_filter,
            from_block=from_block,
            to_block=to_block,
        ).listen_once(
            callback, timeout_callback=timeout_callback, timeout=timeout, blocking=wait
        )

    def get_event_argument_names(self, event_name: str):
        event = getattr(self.contract.events, event_name, None)
        if event:
            return event().argument_names

    def get_event_logs(
        self, event_name, from_block, to_block, filters, web3=None, chunk_size=1000, verbose=True
    ):
        event = getattr(self.events, event_name)
        if not web3:
            web3 = get_web3()

        chunk = chunk_size
        _from = from_block
        _to = _from + chunk - 1

        all_logs = []
        error_count = 0
        _to = min(_to, to_block)
        while _from <= to_block:
            try:
                logs = self.getLogs(
                    event, web3, argument_filters=filters, fromBlock=_from, toBlock=_to
                )
                all_logs.extend(logs)
                _from = _to + 1
                _to = min(_from + chunk - 1, to_block)
                error_count = 0
                # if (_from - from_block) % 1000 == 0:
                if verbose or (_from - from_block) % 1000 == 0:
                    print(
                        f"    So far processed {len(all_logs)} {event_name} events from {_from-from_block} blocks. last block: {_from}"
                    )

            except requests.exceptions.ReadTimeout as err:
                print(f"ReadTimeout ({_from}, {_to}): {err}")
                error_count += 1
                chunk = max(int(chunk / 2), 2)
                _to = min(_from + chunk - 1, to_block)

            except Exception as err:
                print(f"Error ({_from}, {_to}): {err}")
                error_count += 1
                raise

            if error_count > 5:
                break

        print(f"Done processing events, found {len(all_logs)} logs." + "with errors" if error_count else "")
        if error_count:
            raise AssertionError('Errors encountered while fetching event logs.')

        return all_logs

    def getLogs(
        self,
        event,
        web3,
        argument_filters: Optional[Dict[str, Any]] = None,
        fromBlock: Optional[BlockIdentifier] = None,
        toBlock: Optional[BlockIdentifier] = None,
        blockHash: Optional[HexBytes] = None,
    ):
        """Get events for this contract instance using eth_getLogs API.

        This is a stateless method, as opposed to createFilter.
        It can be safely called against nodes which do not provide
        eth_newFilter API, like Infura nodes.
        If there are many events,
        like ``Transfer`` events for a popular token,
        the Ethereum node might be overloaded and timeout
        on the underlying JSON-RPC call.
        Example - how to get all ERC-20 token transactions
        for the latest 10 blocks:
        .. code-block:: python
            from = max(mycontract.web3.eth.blockNumber - 10, 1)
            to = mycontract.web3.eth.blockNumber
            events = mycontract.events.Transfer.getLogs(fromBlock=from, toBlock=to)
            for e in events:
                print(e["args"]["from"],
                    e["args"]["to"],
                    e["args"]["value"])
        The returned processed log values will look like:
        .. code-block:: python
            (
                AttributeDict({
                 'args': AttributeDict({}),
                 'event': 'LogNoArguments',
                 'logIndex': 0,
                 'transactionIndex': 0,
                 'transactionHash': HexBytes('...'),
                 'address': '0xF2E246BB76DF876Cef8b38ae84130F4F55De395b',
                 'blockHash': HexBytes('...'),
                 'blockNumber': 3
                }),
                AttributeDict(...),
                ...
            )
        See also: :func:`web3.middleware.filter.local_filter_middleware`.
        :param argument_filters:
        :param fromBlock: block number or "latest", defaults to "latest"
        :param toBlock: block number or "latest". Defaults to "latest"
        :param blockHash: block hash. blockHash cannot be set at the
          same time as fromBlock or toBlock
        :yield: Tuple of :class:`AttributeDict` instances
        """
        if not self.address:
            raise TypeError(
                "This method can be only called on "
                "an instated contract with an address"
            )

        abi = event._get_event_abi()

        if argument_filters is None:
            argument_filters = dict()

        _filters = dict(**argument_filters)

        blkhash_set = blockHash is not None
        blknum_set = fromBlock is not None or toBlock is not None
        if blkhash_set and blknum_set:
            raise ValidationError(
                "blockHash cannot be set at the same" " time as fromBlock or toBlock"
            )

        # Construct JSON-RPC raw filter presentation based on human readable Python descriptions
        # Namely, convert event names to their keccak signatures
        _, event_filter_params = construct_event_filter_params(
            abi,
            contract_address=self.address,
            argument_filters=_filters,
            fromBlock=fromBlock,
            toBlock=toBlock,
        )

        if blockHash is not None:
            event_filter_params["blockHash"] = blockHash

        # Call JSON-RPC API
        logs = web3.eth.getLogs(event_filter_params)

        # Convert raw binary data to Python proxy objects as described by ABI
        return tuple(get_event_data(abi, entry) for entry in logs)
