// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract InheritanceWallet is Ownable, ReentrancyGuard {
    struct Beneficiary {
        address wallet;
        uint256 share; // in percentage (1–100)
    }

    mapping(address => bool) public guardians;
    mapping(address => Beneficiary) public beneficiaries;
    address[] public beneficiaryList;

    uint256 public lastCheckIn;
    uint256 public heartbeatInterval = 30 days;
    bool public isDeceased;

    event Deposit(address indexed from, uint256 amount);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event BeneficiaryAdded(address indexed wallet, uint256 share);
    event BeneficiaryRemoved(address indexed wallet);
    event HeartbeatUpdated(uint256 timestamp);
    event DeceasedDeclared(address indexed byGuardian);
    event DistributionExecuted();

    // ✅ Fix for OpenZeppelin v5+
    constructor() Ownable(msg.sender) {}

    modifier onlyGuardians() {
        require(guardians[msg.sender], "Not a guardian");
        _;
    }

    // ---------------- OWNER FUNCTIONS ----------------

    function addGuardian(address _guardian) external onlyOwner {
        require(_guardian != address(0), "Invalid address");
        guardians[_guardian] = true;
        emit GuardianAdded(_guardian);
    }

    function removeGuardian(address _guardian) external onlyOwner {
        require(guardians[_guardian], "Not a guardian");
        delete guardians[_guardian];
        emit GuardianRemoved(_guardian);
    }

    function addBeneficiary(address _wallet, uint256 _share) external onlyOwner {
        require(_wallet != address(0), "Invalid address");
        require(_share > 0 && _share <= 100, "Invalid share");
        beneficiaries[_wallet] = Beneficiary(_wallet, _share);
        beneficiaryList.push(_wallet);
        emit BeneficiaryAdded(_wallet, _share);
    }

    function removeBeneficiary(address _wallet) external onlyOwner {
        require(beneficiaries[_wallet].wallet != address(0), "Not found");
        delete beneficiaries[_wallet];

        // remove from array
        for (uint256 i = 0; i < beneficiaryList.length; i++) {
            if (beneficiaryList[i] == _wallet) {
                beneficiaryList[i] = beneficiaryList[beneficiaryList.length - 1];
                beneficiaryList.pop();
                break;
            }
        }

        emit BeneficiaryRemoved(_wallet);
    }

    function updateBeneficiaryShare(address _wallet, uint256 _newShare) external onlyOwner {
        require(beneficiaries[_wallet].wallet != address(0), "Beneficiary not found");
        require(_newShare > 0 && _newShare <= 100, "Invalid share");
        beneficiaries[_wallet].share = _newShare;
    }

    function checkIn() external onlyOwner {
        lastCheckIn = block.timestamp;
        emit HeartbeatUpdated(block.timestamp);
    }

    function setHeartbeatInterval(uint256 _interval) external onlyOwner {
        require(_interval >= 1 days, "Too short");
        heartbeatInterval = _interval;
    }

    // ---------------- GUARDIAN FUNCTIONS ----------------

    function declareDeceased() external onlyGuardians nonReentrant {
        require(block.timestamp > lastCheckIn + heartbeatInterval, "Owner still active");
        require(!isDeceased, "Already declared");
        isDeceased = true;
        emit DeceasedDeclared(msg.sender);
        _distributeETH();
    }

    // ---------------- INTERNAL DISTRIBUTION ----------------

    function _distributeETH() internal {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to distribute");

        for (uint256 i = 0; i < beneficiaryList.length; i++) {
            Beneficiary memory b = beneficiaries[beneficiaryList[i]];
            uint256 amount = (balance * b.share) / 100;
            (bool success, ) = payable(b.wallet).call{value: amount}("");
            require(success, "ETH transfer failed");
        }

        emit DistributionExecuted();
    }

    function distributeERC20(IERC20 token) external nonReentrant {
        require(isDeceased, "Owner not deceased");
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens");

        for (uint256 i = 0; i < beneficiaryList.length; i++) {
            Beneficiary memory b = beneficiaries[beneficiaryList[i]];
            uint256 amount = (balance * b.share) / 100;
            require(token.transfer(b.wallet, amount), "Token transfer failed");
        }

        emit DistributionExecuted();
    }

    // ---------------- VIEWS ----------------

    function getBeneficiaries() external view returns (Beneficiary[] memory list) {
        list = new Beneficiary[](beneficiaryList.length);
        for (uint256 i = 0; i < beneficiaryList.length; i++) {
            list[i] = beneficiaries[beneficiaryList[i]];
        }
    }

    // ---------------- RECEIVE ----------------

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
}
