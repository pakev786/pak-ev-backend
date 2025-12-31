import express from "express";
import BankAccount from "../models/BankAccount.js";

const router = express.Router();

// GET: Fetch all bank accounts
router.get("/", async (req, res) => {
  try {
    const accounts = await BankAccount.find({});
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching accounts", error: error.message });
  }
});

// POST: Add a new bank account
router.post("/", async (req, res) => {
  try {
    const { bankName, accountHolderName, accountNumber, iban } = req.body;

    if (!bankName || !accountHolderName || !accountNumber) {
      return res.status(400).json({ message: "Bank Name, Holder Name, and Account Number are required" });
    }

    const account = new BankAccount({
      bankName,
      accountHolderName,
      accountNumber,
      iban
    });

    const savedAccount = await account.save();
    res.status(201).json(savedAccount);
  } catch (error) {
    res.status(500).json({ message: "Error saving account", error: error.message });
  }
});

// DELETE: Remove a bank account
router.delete("/:id", async (req, res) => {
  try {
    await BankAccount.findByIdAndDelete(req.params.id);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting account", error: error.message });
  }
});

export default router;