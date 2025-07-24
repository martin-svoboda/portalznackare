import React from 'react';
import { IconPlus, IconTrash, IconReceipt } from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';

const createEmptyExpense = () => ({
    id: crypto.randomUUID(),
    date: new Date(),
    description: "",
    amount: 0,
    attachments: []
});

export const ExpensesForm = ({
    expenses,
    onExpensesChange,
    storagePath,
    disabled = false
}) => {
    const handleAddExpense = () => {
        const newExpense = createEmptyExpense();
        onExpensesChange([...expenses, newExpense]);
    };

    const handleUpdateExpense = (expenseId, updates) => {
        const updatedExpenses = expenses.map(exp =>
            exp.id === expenseId ? { ...exp, ...updates } : exp
        );
        onExpensesChange(updatedExpenses);
    };

    const handleRemoveExpense = (expenseId) => {
        const updatedExpenses = expenses.filter(exp => exp.id !== expenseId);
        onExpensesChange(updatedExpenses);
    };

    const handleNumberChange = (expenseId, field, value) => {
        const numValue = parseFloat(value) || 0;
        if (numValue < 0) return;
        handleUpdateExpense(expenseId, { [field]: numValue });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <IconReceipt size={20} />
                    <h3 className="text-lg font-semibold">Dodatečné výdaje</h3>
                </div>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleAddExpense}
                    disabled={disabled}
                >
                    <IconPlus size={16} />
                    Přidat výdaj
                </button>
            </div>

            <div className="space-y-4">
                {expenses.map((expense, index) => (
                    <div key={expense.id} className="card">
                        <div className="card__header">
                            <div className="flex items-center justify-between">
                                <h4 className="card__title">Výdaj {index + 1}</h4>
                                <button
                                    type="button"
                                    className="btn btn--sm btn--danger"
                                    onClick={() => handleRemoveExpense(expense.id)}
                                    disabled={disabled}
                                    title="Odstranit výdaj"
                                >
                                    <IconTrash size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="card__content">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="form__label">Datum *</label>
                                        <input
                                            type="date"
                                            className="form__input"
                                            value={expense.date ? expense.date.toISOString().split('T')[0] : ''}
                                            onChange={(e) => handleUpdateExpense(expense.id, { date: new Date(e.target.value) })}
                                            disabled={disabled}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form__label">Popis výdaje *</label>
                                        <input
                                            type="text"
                                            className="form__input"
                                            value={expense.description || ''}
                                            onChange={(e) => handleUpdateExpense(expense.id, { description: e.target.value })}
                                            placeholder="např. Nákup materiálu, Občerstvení"
                                            disabled={disabled}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form__label">Částka (Kč) *</label>
                                        <input
                                            type="number"
                                            className="form__input"
                                            value={expense.amount || ''}
                                            onChange={(e) => handleNumberChange(expense.id, 'amount', e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                            disabled={disabled}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="form__label">Doklady</label>
                                    <AdvancedFileUpload
                                        id={`expense-${expense.id}-attachments`}
                                        files={expense.attachments || []}
                                        onFilesChange={(files) => handleUpdateExpense(expense.id, { attachments: files })}
                                        maxFiles={5}
                                        accept="image/jpeg,image/png,image/heic,application/pdf"
                                        disabled={disabled}
                                        maxSize={15}
                                        storagePath={storagePath ? `${storagePath}/expense-${index + 1}` : null}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {expenses.length === 0 && (
                <div className="alert alert--info">
                    <p>Žádné dodatečné výdaje nebyly přidány.</p>
                </div>
            )}
        </div>
    );
};