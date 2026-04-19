const { MongoClient, ObjectId } = require('mongodb');

const mongoUri = `mongodb+srv://Shrey:Abc12345*@cluster0.m7b9p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`; // Replace with your actual MongoDB Atlas connection string
//const mongoUri = `mongodb://localhost:27017`; // Replace with your actual MongoDB Atlas connection string

const client = new MongoClient(mongoUri);

// structure of database
/*
    TabCompany---|---TabParty ---(Billto,Shipto)-----> TabSalesMaster---|
                 ^                                         ^
        TabCmpOrPartyDetails                            TabSalesDetail---|
                                                                         ^
                                                                      Tab Item
*/


// Function to insert data into the given collection
async function insertCompanyData(
    db,
    CmpName,
    DetailIDs,
    BankName,
    BankACNo,
    BankIFSCNo,
    BankBranch,
	collectionName = 'TabCompany',
	TandC = "1) Goods once supplied will not be taken back or exchanged.\n2) Our Responsibility ceases on Delivery at Morbi factory.\n3) Insurance shall be covered by purchaser.",
    Declaration = "I Certified that particulars are true and correct, and the amount indicated represents the price actually charged and that there is no flow of additional consideration directly from buyer\nSubject to Morbi Jurisdiction Only. E & O.E"
) {
    try {
		if (!db) throw new Error("Database connection is not available.");
    
        const collection = db.collection(collectionName);

        // Check if collection exists, if not create by inserting one document
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await collection.insertOne({ init: true }); // Insert dummy data to create the collection
            await collection.deleteOne({ init: true }); // Remove dummy data
        }

        // Insert the actual data
        const result = await collection.insertOne({
            CmpName,
            DetailIDs,
            TandC,
            Declaration,
            BankName,
            BankACNo,
            BankIFSCNo,
            BankBranch,
        });

        return result.insertedId;
    } catch (error) {
        console.error("Error inserting company data:", error);
        throw error;
    }
}

async function insertPartyData(
    db,
    //PartyUID,
    PartyName,
    DetailIDs,
    PhoneNumber = "",
    //TabItem,
	collectionName = 'TabParty'
) {
    try {
		if (!db) throw new Error("Database connection is not available.");
		
        const collection = db.collection(collectionName);

        // Check if collection exists, if not create by inserting one document
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await collection.insertOne({ init: true }); // Insert dummy data to create the collection
            await collection.deleteOne({ init: true }); // Remove dummy data
        }

        // Insert the actual data
        const result = await collection.insertOne({
            //PartyUID,
            PartyName,
            PhoneNumber,
            DetailIDs,
            //TabItem
        });

        return result.insertedId;
    } catch (error) {
        console.error("Error inserting party data:", error);
        throw error;
    }
}

async function insertSalesMasterData(
    db,
    id,
    SalesUID,
    CompanyAddrNo,
    InvNo,
    InvNoLayout,
    MemoType,
    InvType,
    CopyType,
    BillToPartyUID,
    ShipToPartyUID,
    BillToAddressUID,
    ShipToAddressUID,
    TransportDetails,
    InvDate,
    BodyLayoutNo,
    SalesType,
    Remark,
    TotalVal,
    DiscountPer,
    DiscountRs,
    PackagingCharge,
    TaxableVal,
    TotalTax,
    GrandTotal,
    collectionName = 'TabSalesMaster'
) {
    try {
        if (!db) throw new Error("Database connection is not available.");
        console.log(id);
        const collection = db.collection(collectionName);

        // Ensure collection exists
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await collection.insertOne({ init: true });
            await collection.deleteOne({ init: true });
        }

        // Prepare the document
        const document = {
            SalesUID,
            CompanyAddrNo,
            InvNo,
            InvNoLayout,
            MemoType,
            InvType,
            CopyType,
            BillToPartyUID,
            ShipToPartyUID,
            BillToAddressUID,
            ShipToAddressUID,
            TransportDetails,
            InvDate,
            BodyLayoutNo,
            SalesType,
            Remark,
            TotalVal,
            DiscountPer,
            DiscountRs,
            PackagingCharge,
            TaxableVal,
            TotalTax,
            GrandTotal,
        };

        // If a valid ID is provided, add it as _id
        if (id && ObjectId.isValid(id)) {
            document._id = new ObjectId(id);
        }

        // Insert the document
        const result = await collection.insertOne(document);
        return result.insertedId;

    } catch (error) {
        console.error("Error inserting sales master data:", error);
        throw error;
    }
}

async function insertSalesDetailData(
    db,
    SrNo,
    SalesUID, // need to generate
    ItemID,
    Qty,
    Rate,
    Value,
    ExtraItemValues,
    collectionName = 'TabSalesDetail'
) {
    try {
        if (!db) throw new Error("Database connection is not available.");
		
        const collection = db.collection(collectionName);

        // Check if collection exists, if not create by inserting one document
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await collection.insertOne({ init: true }); // Insert dummy data to create the collection
            await collection.deleteOne({ init: true }); // Remove dummy data
        }

        // Insert the actual data
        const result = await collection.insertOne({
            SrNo,
            SalesUID,
            ItemID,
            Qty,
            Rate,
            Value,
            ExtraItemValues
        });

        return result.insertedId;
    } catch (error) {
        console.error("Error inserting sales detail data:", error);
        throw error;
    }
}

async function insertCmpOrPartyDetails(
    db,
    DetailNo,
    Addr,
    GSTIN,
    PartyStateAndCode = null, // Only used for TabParty, otherwise null
    collectionName = 'TabCmpOrPartyDetails'
) {
    try {
        if (!db) throw new Error("Database connection is not available.");
		
        const collection = db.collection(collectionName);

        // Check if collection exists, if not create by inserting one document
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await collection.insertOne({ init: true }); // Insert dummy data to create the collection
            await collection.deleteOne({ init: true }); // Remove dummy data
        }

        // Prepare the document
        const document = { DetailNo, Addr, GSTIN };
        if (PartyStateAndCode !== null) {
            document.PartyStateAndCode = PartyStateAndCode;
        }

        // Insert the actual data
        const result = await collection.insertOne(document);

        return result.insertedId;
    } catch (error) {
        console.error("Error inserting company or party details:", error);
        throw error;
    }
}

async function InsertTabItemData(
    db,
    //ItemUID,
    ItemName,
    Unit,
    HSN,
    GSTPer,
    collectionName = 'TabItem'
) {
    try {
        if (!db) throw new Error("Database connection is not available.");

        const collection = db.collection(collectionName);

        // Check if collection exists, if not create by inserting one document
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await collection.insertOne({ init: true }); // Insert dummy data to create the collection
            await collection.deleteOne({ init: true }); // Remove dummy data
        }

        // Insert the actual data
        const result = await collection.insertOne({
            //ItemUID,
            ItemName,
            Unit,
            HSN,
            GSTPer
        });

        return result.insertedId;
    } catch (error) {
        console.error("Error inserting item data:", error);
        throw error;
    }
}

async function insertReceiptData(db, receiptNo, receiptDate, partyName, amount, narration, isAdjustment,collectionName = 'TabReceipt') {
    try {
        if (!db) throw new Error("Database connection is not available");

        const collection = db.collection(collectionName);

        // Ensure collection exists
        const existingCollection = await db.listCollections({ name: collectionName }).toArray();
        if (existingCollection.length === 0) {
            await db.createCollection(collectionName);
        }

        // Insert receipt with structured data
        const result = await collection.insertOne({
            receiptNo: receiptNo,
            receiptDate: receiptDate, 
            partyName: partyName.trim(), // Trim whitespace for consistency
            amount: parseFloat(amount), // Convert amount to float
            narration: narration?.trim() || "", // Default to empty string if missing
            isAdjustment: Boolean(isAdjustment)
        });

        return result;
    } catch (error) {
        console.error("Error inserting receipt:", error);
        throw error;
    }
}



/*now retrivers*/
// Generic function to fetch data from any collection
async function getDataFromCollection(db, collectionName, query = {}) {
    try {
        if (!db) throw new Error("Database connection is not available.");
        if (!collectionName) throw new Error("Collection name is required.");

        const collection = db.collection(collectionName);
        return await collection.find(query).toArray();
    } catch (error) {
        console.error(`Error fetching data from ${collectionName}:`, error);
        throw error;
    }
}


async function deleteCollection(db, collectionName) {
    try {
        if (!db) throw new Error("Database connection is not available.");
        
        await db.collection(collectionName).drop();
        
        return true; // Success
    } catch (error) {
        console.error("Error deleting collection:", error);
        return false; // Failure
    }
}


async function deleteCmpOrPartyDetails(db, DetailNos, collectionName = 'TabCmpOrPartyDetails') {
    try {
        if (!db) throw new Error("Database connection is not available.");

        const collection = db.collection(collectionName);

        // Delete all records where DetailNo matches any value in DetailNos array
        const result = await collection.deleteMany({ DetailNo: { $in: DetailNos } });

        return result.deletedCount; // Returns the number of deleted documents
    } catch (error) {
        console.error("Error deleting company or party details:", error);
        throw error;
    }
}

// Generic delete function for any collection
async function deleteData(db, collectionName, query) {
    try {
        if (!db) throw new Error("Database connection is not available.");
        if (!collectionName) throw new Error("Collection name is required.");
        if (!query || Object.keys(query).length === 0) {
            throw new Error("Query must be provided to delete documents");
        }

        const collection = db.collection(collectionName);
        const result = await collection.deleteMany(query);
        return result.deletedCount;
    } catch (error) {
        console.error(`Error deleting data from ${collectionName}:`, error);
        throw error;
    }
}

// Generic update function for any collection
async function updateData(db, collectionName, query, updateData, options = {}) {
    try {
        if (!db) throw new Error("Database connection is not available.");
        if (!collectionName) throw new Error("Collection name is required.");
        if (!query || Object.keys(query).length === 0) {
            throw new Error("Query must be provided to update documents");
        }
        if (!updateData || Object.keys(updateData).length === 0) {
            throw new Error("Update data must be provided");
        }

        const collection = db.collection(collectionName);
        const result = await collection.updateMany(
            query,
            { $set: updateData },
            options
        );
        return result.modifiedCount;
    } catch (error) {
        console.error(`Error updating data in ${collectionName}:`, error);
        throw error;
    }
}

module.exports = {
    client,
    insertCompanyData, insertPartyData, insertSalesMasterData, insertReceiptData,
    insertSalesDetailData, insertCmpOrPartyDetails, InsertTabItemData,
    getDataFromCollection, deleteCollection, deleteCmpOrPartyDetails,
    // Add the new functions
    deleteData, updateData
    /*deleteCompanyData, updateCompanyData,
    deletePartyData, updatePartyData,
    deleteSalesMasterData, updateSalesMasterData,
    deleteSalesDetailData, updateSalesDetailData,
    deleteCmpOrPartyDetails, updateCmpOrPartyDetails,
    deleteItemData, updateItemData*/
};


