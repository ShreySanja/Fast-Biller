import React, { useEffect, useState } from "react";

export default function Items() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [items, setItems] = useState([]);
    const [editedRows, setEditedRows] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(0);
    const [deleteQueue, setDeleteQueue] = useState([]);

    // Function to add an ID to delete queue
    const queueDelete = (id) => {
        setDeleteQueue(prevQueue => [...prevQueue, id]);
    };

    useEffect(() => {
        fetch(`${API_BASE_URL}/getitemdata`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: {} })
        })
            .then((res) => res.json())
            .then((data) => {
                // Normalize _id so it's always a string
                const formattedData = data.map(item => ({
                    ...item,
                    _id: item._id.$oid || item._id
                }));
                setItems(formattedData);
            })
            .catch((error) => console.error("Error fetching items:", error));
    }, []);

    // New row: use _id as a string directly
    const addRow = () => {
        const newRow = {
            _id: `new-${Date.now()}`,
            ItemName: "",
            Unit: "",
            HSN: "",
            GSTPer: "",
            isNew: true,
            isEdited: true
        };
        setItems([...items, newRow]);
    };

    // Use functional updates and compare using string _id
    const handleChange = (id, field, value) => {
        setItems(prevItems =>
            prevItems.map(item =>
                item._id === id ? { ...item, [field]: value, isEdited: true } : item
            )
        );

        setEditedRows(prev => ({ ...prev, [id]: true }));
    };

    const queueDeleteRow = (id) => {
        const idToSend = id?.$oid || id;

        // Add to delete queue
        setDeleteQueue(prevQueue => [...prevQueue, idToSend]);

        // Remove from UI immediately
        setItems(prevItems => prevItems.filter(item => (item._id?.$oid || item._id) !== idToSend));
    };


    const deleteRow = async (id) => {
        console.log('Deleting ID:', id);
        const idToSend = id?.$oid || id;

        try {
            const response = await fetch(`${API_BASE_URL}/deleteitem`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: { _id: idToSend } })
            });

            const result = await response.json();
            if (!result.success) {
                console.error("Delete failed:", result.error);
            }
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    const saveChanges = async () => {
        setIsSaving(true);
        setSaveProgress(0);

        const newItems = items.filter(item => item.isNew);
        const updatedItems = items.filter(item => item.isEdited && !item.isNew);
        const totalOperations = deleteQueue.length + newItems.length + updatedItems.length;
        let completedOperations = 0;

        // Process the delete queue first
        for (let id of deleteQueue) {
            await deleteRow(id);
            completedOperations += 1;
            setSaveProgress((completedOperations / totalOperations) * 100);
        }

        // Save new items
        if (newItems.length > 0) {
            await fetch(`${API_BASE_URL}/additem`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: newItems })
            });
            completedOperations += newItems.length;
            setSaveProgress((completedOperations / totalOperations) * 100);
        }

        // Update existing items
        if (updatedItems.length > 0) {
            for (let item of updatedItems) {
                console.log('Updating:', item._id);
                await fetch(`${API_BASE_URL}/updateitem`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: { _id: item._id },
                        updateFields: {
                            ItemName: item.ItemName,
                            Unit: item.Unit,
                            HSN: item.HSN,
                            GSTPer: item.GSTPer
                        }
                    })
                });
                completedOperations += 1;
                setSaveProgress((completedOperations / totalOperations) * 100);
            }
        }

        // Reset state after save
        setItems(prevItems =>
            prevItems.filter(item => !deleteQueue.includes(item._id)).map(item => ({
                ...item,
                isNew: false,
                isEdited: false
            }))
        );

        setDeleteQueue([]); // Clear delete queue
        setEditedRows({});

        setTimeout(() => {
            setIsSaving(false);
            setSaveProgress(0);
        }, 500);
    };


    const getRowStatus = (id) => {
        const item = items.find(i => i._id === id);
        if (item?.isEdited || item?.isNew) return 'unsaved';
        return '';
    };


    const [filters, setFilters] = useState({
        ItemName: "",
        Unit: "",
        HSN: "",
        GSTOperator: "=",
        GSTPer: ""
    });

    // Handle filter input changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Toggle GST Operator
    const toggleGSTOperator = () => {
        setFilters(prev => ({
            ...prev,
            GSTOperator: prev.GSTOperator === "=" ? "<" : prev.GSTOperator === "<" ? ">" : "="
        }));
    };

    // Filter the items based on the input fields
    const filteredItems = items.filter(item => {
        const matchItemName = filters.ItemName ? item.ItemName.toLowerCase().includes(filters.ItemName.toLowerCase()) : true;
        const matchUnit = filters.Unit ? item.Unit.toLowerCase().includes(filters.Unit.toLowerCase()) : true;
        const matchHSN = filters.HSN ? item.HSN.toLowerCase().includes(filters.HSN.toLowerCase()) : true;
        const matchGST = filters.GSTPer
            ? filters.GSTOperator === "="
                ? parseFloat(item.GSTPer) === parseFloat(filters.GSTPer)
                : filters.GSTOperator === "<"
                    ? parseFloat(item.GSTPer) < parseFloat(filters.GSTPer)
                    : parseFloat(item.GSTPer) > parseFloat(filters.GSTPer)
            : true;

        return matchItemName && matchUnit && matchHSN && matchGST;
    });

    return (
        <div className="container">
            <style>
                {`
                .container {
                    padding: 1.5rem;
                    max-width: 900px;
                    margin: 0 auto;
                    background: #ffffff;
                    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }
                h2 {
                    text-align: center;
                    font-size: 1.8rem;
                    color: #333;
                    margin-bottom: 1rem;
                    font-family: 'Roboto Slab', Arial, sans-serif;
                }

                input:hover, 
                textarea:hover{
                    border: 1px solid lightgray;
                    outline: none;
                }
 
                input:focus, 
                textarea:focus {
                    border: 1px solid blue;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1.5rem;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #fff;
                    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 7px;
                    text-align: left;
                    font-size: 1rem;
                }
                th {
                    background-color: #61abff;
                    color: #fff;
                    padding: 12px;
                    font-weight: bold;
                    font-family: 'Roboto Slab', Arial, sans-serif;
                }
                td {
                    background-color: #f9f9f9;
                    transition: background 0.3s ease;
                }
                tr:hover td {
                    background: #f1f1f1;
                }
                @keyframes fadeOut {
                    to { background-color: rgba(144, 238, 144, 0); }
                }
                .buttons {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 1rem;
                }
                .btn {
                    padding: 10px 15px;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                    border-radius: 5px;
                    margin: 5px;
                    position: relative;
                    overflow: hidden;
                }
                .add-btn { 
                    background-color: #28a745; 
                    color: white; 
                }
                .save-btn { 
                    background-color: #007bff; 
                    color: white;
                    min-width: 100px;
                }
                .save-btn:disabled {
                    background-color: #6c757d;
                    cursor: not-allowed;
                }
                .save-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background-color: rgba(255, 255, 255, 0.7);
                    transition: width 0.3s ease;
                }
                .del-btn {
                    cursor: pointer;
                    background: none;
                    border: none;
                    color: #dc3545;
                    font-size: 1.2rem;
                }

                /* Placeholder text color */
thead th input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

thead td input{
    width:100%;
    text-align: center;
}

thead tr th{
    height:30px;
}

                thead th {
    position: relative;
    text-align: left;
    padding: 8px;
    
    white-space: nowrap;
}

.gst-filter input {
    width: 40%;
    padding: 4px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

.gst-filter {
    display: flex;
    align-items: center;
    gap: 5px;
}

.gst-filter button {
    padding: 4px 6px;
    font-size: 14px;
    border: 1px solid #ccc;
    background: white;
    cursor: pointer;
    border-radius: 4px;
}

.gst-filter button:hover {
    background: #f0f0f0;
}

                `}
            </style>

            <h2>Items List</h2>

            <table>
                <thead>
                    <tr>
                        <th style={{ textAlign:'center' }}>Item Name</th>
                        <th style={{ textAlign: 'center' }}>Unit</th>
                        <th style={{ textAlign: 'center' }}>HSN</th>
                        <th style={{ textAlign: 'center' }}>GST %</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                </thead>
                <thead>
                    <tr>
                        <td><input type="text" placeholder="Filter" value={filters.ItemName} onChange={(e) => handleFilterChange("ItemName", e.target.value)} /></td>
                        <td><input type="text" placeholder="Filter" value={filters.Unit} onChange={(e) => handleFilterChange("Unit", e.target.value)} /></td>
                        <td><input type="text" placeholder="Filter" value={filters.HSN} onChange={(e) => handleFilterChange("HSN", e.target.value)} /></td>
                        <td><div className="gst-filter">
                            <button onClick={toggleGSTOperator}>{filters.GSTOperator}</button>
                            <input type="number" placeholder="Filter" value={filters.GSTPer} onChange={(e) => handleFilterChange("GSTPer", e.target.value)} />
                        </div>
                        </td>
                        <td></td>
                    </tr>
                </thead>
                <tbody>
                    {filteredItems.length > 0 ? (
                        filteredItems.map(item => (
                            <tr key={item._id}>
                                <td>
                                    <input type="text" value={item.ItemName || ""} onChange={(e) => handleChange(item._id, "ItemName", e.target.value)} />
                                </td>
                                <td>
                                    <input type="text" value={item.Unit || ""} onChange={(e) => handleChange(item._id, "Unit", e.target.value)} />
                                </td>
                                <td>
                                    <input type="text" value={item.HSN || ""} onChange={(e) => handleChange(item._id, "HSN", e.target.value)} />
                                </td>
                                <td>
                                    <input type="text" value={item.GSTPer || ""} onChange={(e) => handleChange(item._id, "GSTPer", e.target.value)} />
                                </td>
                                <td style={{ textAlign: "center" }}>
                                    <button className="del-btn" onClick={() => queueDeleteRow(item._id)}>🗑️</button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" style={{ textAlign: "center" }}>No Items Found</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Buttons */}
            <div className="buttons">
                <button className="btn add-btn" onClick={addRow}>➕ Add Item</button>
                <button className="btn save-btn" onClick={saveChanges} disabled={isSaving || !(items.some(item => item.isNew || item.isEdited) || deleteQueue.length > 0)}>
                    {isSaving ? 'Saving...' : '💾 Save'}
                    {isSaving && <div className="save-progress" style={{ width: `${saveProgress}%` }}></div>}
                </button>
            </div>
        </div>
    );
}
