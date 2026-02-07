// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

type Currency is address;

library CurrencyLibrary {
    Currency public constant NATIVE = Currency.wrap(address(0));

    function isNative(Currency currency) internal pure returns (bool) {
        return Currency.unwrap(currency) == Currency.unwrap(NATIVE);
    }
}
