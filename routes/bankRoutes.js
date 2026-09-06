import express from "express";
import { protectAdmin, protectUserOrAdmin, requirePermission } from "../middleware/authMiddleware.js";
import BankAccount from "../models/BankAccount.js";
import { isNonEmptyString, isValidObjectId, asString } from "../utils/validate.js";

const router = express.Router();

// GET: Fetch all bank accounts.
// Account numbers / IBANs are payment details, so they are only handed to
// signed-in customers (who are about to check out) and to admins.
router.get("/", protectUserOrAdmin, async (req, res) => {
  try {
    const accounts = await BankAccount.find({});
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching accounts", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Add a new bank account
router.post("/", protectAdmin, requirePermission("accounts"), async (req, res) => {
  try {
    const { bankName, accountHolderName, accountNumber, iban } = req.body;

    if (!isNonEmptyString(bankName) || !isNonEmptyString(accountHolderName) || !isNonEmptyString(accountNumber)) {
      return res.status(400).json({ message: "Bank Name, Holder Name, and Account Number are required" });
    }

    const account = new BankAccount({
      bankName: asString(bankName).slice(0, 100),
      accountHolderName: asString(accountHolderName).slice(0, 100),
      accountNumber: asString(accountNumber).slice(0, 40),
      iban: asString(iban).slice(0, 40)
    });

    const savedAccount = await account.save();
    res.status(201).json(savedAccount);
  } catch (error) {
    res.status(500).json({ message: "Error saving account", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// DELETE: Remove a bank account
router.delete("/:id", protectAdmin, requirePermission("accounts"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid account id" });
    await BankAccount.findByIdAndDelete(req.params.id);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting account", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;