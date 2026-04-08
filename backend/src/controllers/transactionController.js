const { listTransactionsForUser } = require("../services/creditService");

async function getTransactions(req, res) {
  const transactions = await listTransactionsForUser(req.user.id, 100);
  return res.json({ transactions });
}

module.exports = { getTransactions };
