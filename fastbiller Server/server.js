const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config(); // Load variables from .env

const { deleteData, updateData, insertSalesMasterData, insertReceiptData, insertCompanyData, insertSalesDetailData, insertCmpOrPartyDetails, insertPartyData, InsertTabItemData, getDataFromCollection, deleteCollection, deleteCmpOrPartyDetails } = require('./DataExchenger');


//not used yet idk why
const fs = require("fs");
const path = require("path");

let currentDb = null;

//experimental
process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err);
});


// Function to delete a database
const deleteDatabase = async (dbName) => {
    try {
        // Get the admin database
        const adminDb = client.db().admin();

        // List all databases
        const dbs = await adminDb.listDatabases();

        // Check if the database exists
        if (!dbs.databases.some(db => db.name === dbName)) {
            return false; // Database does not exist
        }

        // Drop the database
        await client.db(dbName).dropDatabase();
        console.log(`Database ${dbName} deleted successfully.`);
        return true;
    } catch (error) {
        console.error("Error deleting database:", error);
        return false;
    }
};

const app = express();
app.use(express.json());  // Middleware to parse JSON
app.use(cors());          // Allow frontend to access backend

const uri = process.env.MONGO_URI;
//const uri = `mongodb+srv://Shrey:Abc12345*@cluster0.m7b9p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`; 
//const uri = `mongodb://localhost:27017`;


let client = new MongoClient(uri);
let db = null; // Store the database connection globally

// Initialize the database connection once and store it
const connectToDatabase = async (dbName, retries = 5) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Completely recreate the client if topology is destroyed
            if (client && (client.topology?.isDestroyed() || !client.topology?.isConnected())) {
                console.warn("Client topology destroyed. Creating new client...");
                await client.close();
                client = new MongoClient(process.env.MONGO_URI, {
                    connectTimeoutMS: 5000,
                    socketTimeoutMS: 30000,
                    serverSelectionTimeoutMS: 5000,
                    retryWrites: true,
                    retryReads: true
                });
            }

            if (!client.topology?.isConnected()) {
                await client.connect();
            }

            const database = client.db(dbName);
            currentDb = database;
            currentDbName = dbName;

            console.log("Connected to DB:", dbName);
            return database;

        } catch (err) {
            console.error(`Attempt ${attempt} failed:`, err.message);
            if (attempt === retries) {
                // Force client recreation on next attempt
                if (client) {
                    await client.close().catch(() => { });
                    client = null;
                }
                throw err;
            }
            await new Promise(res => setTimeout(res, 2000 * attempt)); // Exponential backoff
        }
    }
};




// Function to check if a database exists
const checkIfDatabaseExistsAndConnect = async (dbName) => {
    try {
        const connection = await connectToDatabase(dbName);

        // Verify connection is actually working
        await connection.command({ ping: 1 });

        const databases = await connection.admin().listDatabases();
        return databases.databases.some(db => db.name === dbName);
    } catch (error) {
        console.error("Error checking database:", error);
        return false;
    }
};

//only for storing
const defaultLayout = [
    { name: "srNo", label: "SrNo", type: "number", align: "left", width: "50px", isReadOnly: true, isMandatory: true },
    { name: "productName", label: "Product Name", type: "text", align: "left", width: "400px", isReadOnly: false, isMandatory: true },
    { name: "hsn", label: "HSN", type: "text", align: "center", width: "80px", isReadOnly: false, isMandatory: true },
    { name: "qty", label: "Qty", type: "number", align: "right", width: "90px", isReadOnly: false, isMandatory: true },
    { name: "rate", label: "Rate", type: "number", align: "right", width: "90px", isReadOnly: false, isMandatory: true },
    { name: "unit", label: "Unit", type: "text", align: "center", width: "45px", isReadOnly: false, isMandatory: true },
    { name: "gst", label: "GST%", type: "number", align: "right", width: "55px", isReadOnly: false, isMandatory: true },
    { name: "amount", label: "Amount", type: "number", align: "right", width: "130px", isReadOnly: true, isMandatory: true }
];

// Function to create a database if it doesn't exist
const createCompanyDatabase = async (dbName) => {
    try {
        const exists = await checkIfDatabaseExistsAndConnect(dbName);
        if (exists) return false;

        const connection = await connectToDatabase(dbName);

        // Extract the first word before a dash
        const companyName = dbName || "Company";
        const companyWord = companyName.split("-")[0] || "Company";
        const invoiceLayout = `${companyWord}/{000}`;

        const uid = generateUID();

        // 🧠 Smart BusinessDate calculation based on today
        const today = new Date();
        const currentYear = today.getFullYear();
        const aprilFirstThisYear = new Date(`${currentYear}-04-01`);

        let start, end;
        if (today >= aprilFirstThisYear) {
            start = `${currentYear}-04-01`;
            end = `${currentYear + 1}-03-31`;
        } else {
            start = `${currentYear - 1}-04-01`;
            end = `${currentYear}-03-31`;
        }

        await connection.collection("defaultCollection").insertOne({
            InvoiceNoLayout: [invoiceLayout],
            BodyLayouts: {
                [uid]: defaultLayout
            },
            LastBodyLayout: uid,
            BusinessDate: {
                start,
                end
            }
        });

        return true;
    } catch (error) {
        console.error("Error creating database:", error);
        return false;
    }
};

// API to create a new company database
app.post("/create-database", async (req, res) => {
    try {
        const { companyName, tabCompanyData } = req.body;

        if (!companyName) {
            return res.status(400).json({ error: "Missing companyName or tabCompanyData" });
        }

        const exists = await checkIfDatabaseExistsAndConnect(companyName);
        if (exists) {
            return res.status(400).json({ error: "Database already exists" });
        }

        const created = await createCompanyDatabase(companyName);
        if (created) {

            // Get the new database connection for the newly created database
            const newDb = await connectToDatabase(companyName);
            
            // Extract all RandomUIDs as an array
            const randomUIDs = tabCompanyData.addresses.map(address => address.RandomUID);
            
            for (const address of tabCompanyData.addresses) {
				await insertCmpOrPartyDetails(
					newDb, 
					address.RandomUID, 
					address.Address,   
					address.GSTIN      
				);
			}


            // Pass the newDb to insertCompanyData
            await insertCompanyData(
                newDb,
                companyName,
                randomUIDs, // Now passing an array
                tabCompanyData.bankDetails.BankName,
                tabCompanyData.bankDetails.BankAccountNo,
                tabCompanyData.bankDetails.BankIFSCNo,
                tabCompanyData.bankDetails.BankBranch
            );

            
            return res.status(201).json({ message: "Company database created successfully!" });
        } else {
            return res.status(500).json({ error: "Failed to create database" });
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.post("/check-database-exists", async (req, res) => {
    try {
        const { dbName } = req.body;
        if (!dbName) {
            return res.status(400).json({ error: "Database name is required." });
        }

        const exists = await checkIfDatabaseExistsAndConnect(dbName);

        res.json({ exists }); // ✅ Return only true or false
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/get-db-data", async (req, res) => {
    try {
        let { companyName } = req.body;

        if (!companyName) {
            return res.status(400).json({ error: "Company name is required." });
        }

        if (true) {
            db = await connectToDatabase(companyName); // Connect to selected company's database
            if (!db) {
                return res.status(500).json({ error: "Database connection failed." });
            }
        }

        let data = await getDataFromCollection(db, "TabCompany");
        let detailNos = data.flatMap(item => item.DetailIDs || []);
        let addresses = detailNos.length ? await getDataFromCollection(db, "TabCmpOrPartyDetails", { DetailNo: { $in: detailNos } }) : [];

        let bankData = data.map(({ BankACNo, BankBranch, BankIFSCNo, BankName }) => ({
            BankACNo,
            BankBranch,
            BankIFSCNo,
            BankName
        }));

        let other = data.map(({ TandC, Declaration }) => ({ TandC, Declaration }));

        res.json({ addresses, bankData, other });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API to get all company names
app.get("/get-all-companies", async (req, res) => {
    try {
        // Connect to the admin database to list all databases
        const adminDb = client.db().admin();

        // List all databases
        const databases = await adminDb.listDatabases();

        // Filter out system databases and get only your application's company databases
        const companyDatabases = databases.databases
            .filter(db => !['admin', 'local', 'config'].includes(db.name))
            .map(db => db.name);

        // Alternatively, if you're maintaining a separate collection for company names
        // (which would be more efficient than listing all databases)
        // You could query that collection here

        res.json({ companies: companyDatabases });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API to delete a company database
app.post("/delete-company", async (req, res) => {
    try {
        const { companyName } = req.body;
        if (!companyName) {
            return res.status(400).json({ error: "Company name is required." });
        }

        const deleted = await deleteDatabase(companyName);
        if (deleted) {
            return res.json({ message: "Database deleted successfully." });
        } else {
            return res.status(404).json({ error: "Database not found." });
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.post("/update-company", async (req, res) => {
    try {
        const { companyName, tabCompanyData } = req.body;
        const { oldDetailNo, openCompanyAddresses, openBankDetails, otherDetails } = tabCompanyData;

        // Step 1: Delete existing records by DetailNo
        await deleteCmpOrPartyDetails(db, oldDetailNo);

        // Step 2: Delete the entire TabCompany collection
        await deleteCollection(db, "TabCompany");

        // Step 3: Insert new address details
        const randomUIDs = openCompanyAddresses.map(address => address.RandomUID);
        for (const address of openCompanyAddresses) {
            await insertCmpOrPartyDetails(db, address.RandomUID, address.Address, address.GSTIN);
        }
		
        // Step 4: Insert new company data
        await insertCompanyData(
            db,
            companyName,
            randomUIDs, // Pass all RandomUIDs as an array
            openBankDetails.BankName,
            openBankDetails.BankAccountNo,
            openBankDetails.BankIFSCNo,
            openBankDetails.BankBranch,
			'TabCompany',
			otherDetails.TandC,
			otherDetails.Declaration
        );

        res.json({ message: "Company updated successfully" });

    } catch (error) {
        console.error("Error updating company:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//isReturnID="false"

function generateUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let uid = '';
    for (let i = 0; i < 7; i++) {
        uid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return uid;
}

//these all will first check if any similar exists if does then update it with the current data and if none exists it will add one
const createPartyAndGetID = async (Name, Addr, StateAndCode, GSTIN) => {
    try {
        // Get or create the Address Detail ID
        const detailID = await createAddrDetail(Addr, GSTIN, StateAndCode);

        // Check if a party with the same Name exists
        const existingParty = await getDataFromCollection(currentDb, "TabParty", { PartyName: Name });

        if (existingParty.length > 0) {
            // Retrieve existing detail IDs
            let detailIDs = existingParty[0].DetailIDs || [];

            // Add the new detailID only if it's not already in the list
            if (detailID && !detailIDs.includes(detailID)) {
                detailIDs.push(detailID);

                // Update the existing party record with new detail IDs
                await currentDb.collection('TabParty').updateOne(
                    { PartyName: Name },
                    { $set: { DetailIDs: detailIDs } }
                );
            }

            // Return object with consistent structure
            return {
                partyID: existingParty[0]._id,
                detailID: detailID
            };
        } else {
            // Insert a new party with the first detail ID
            const insertedID = await insertPartyData(currentDb, Name, [detailID]);

            // Return object with consistent structure
            return {
                partyID: insertedID,
                detailID: detailID
            };
        }
    } catch (error) {
        console.error("Error in createPartyAndGetID:", error);
        throw error;
    }
};

//currently we are checking for different address we can also check if they have same GSTIN as well(not needed)
const createAddrDetail = async (Address, GSTIN, StateAndCode) => {
    try {
        // Check for existing address
        const existingRecords = await getDataFromCollection(currentDb, "TabCmpOrPartyDetails", {
            Addr: Address,
            GSTIN,
            PartyStateAndCode: StateAndCode
        });

        if (existingRecords.length > 0) {
            // Return the existing DetailNo if found
            return existingRecords[0].DetailNo;
        } else {
            // Generate a new DetailNo
            const newDetailNo = generateUID();

            // Insert the new record
            await currentDb.collection("TabCmpOrPartyDetails").insertOne({
                DetailNo: newDetailNo,
                Addr: Address,
                GSTIN,
                PartyStateAndCode: StateAndCode
            });

            return newDetailNo;
        }
    } catch (error) {
        console.error("Error in createAddrDetail:", error);
        return null; // Return null explicitly on failure
    }
};




const createItemAndGetID = async (ItemName, Unit, HSN, GSTPer) => {
    try {
        // Fetch existing records matching HSN
        const existingItems = await getDataFromCollection(currentDb, 'TabItem', { HSN });

        if (existingItems.length > 0) {
            // Check if an item with the same name already exists
            const existingItem = existingItems.find(item => item.ItemName === ItemName);

            if (existingItem) {
                // If same ItemName exists, update the record
                await currentDb.collection('TabItem').updateOne(
                    { _id: existingItem._id },
                    { $set: { ItemName, Unit, HSN, GSTPer } }
                );

                return existingItem._id; // Return existing item ID
            }
        }

        // If no matching ItemName exists, insert a new record
        const insertedID = await InsertTabItemData(currentDb, ItemName, Unit, HSN, GSTPer);

        return insertedID; // Return newly inserted Item ID
    } catch (error) {
        console.error("Error in createItemAndGetID:", error);
        throw error;
    }
};


const createSalesDetailAndGetID = async (ItemName, Unit, HSN, GSTPer, SalesUID, SrNo, Qty, Rate, Value, ExtraItemValues=[]) => {
    try {
        // Get or create ItemID using createItemAndGetID
        const ItemID = await createItemAndGetID(ItemName, Unit, HSN, GSTPer);

        // Insert the sales detail record
        const insertedID = await insertSalesDetailData(currentDb, SrNo, SalesUID, ItemID, Qty, Rate, Value, ExtraItemValues);

        return insertedID; // Return the inserted sales detail ID
    } catch (error) {
        console.error("Error in createSalesDetailAndGetID:", error);
        throw error;
    }
};

const insertMasterBill = async (
    id,
    FullLayout,
    CompanyAddr,
    AllItemDetails,
    BillToPartyName,
    BillToPartyAddr,
    BillToPartyStateAndCode,
    BillToPartyGSTIN,
    ShipToPartyName,
    ShipToPartyAddr,
    ShipToPartyStateAndCode,
    ShipToPartyGSTIN,
    TranspDetail,
    MemoType,
    InvType,
    CopyType,
    InvNumber,
    InvNoLayout,
    InvDate,
    BodyLayoutNo,
    SalesType,
    Remark,
    TotalVal,
    DiscountPer,
    DiscountRs,
    PackCharge,
    TaxableVal,
    TotalTax,
    GrandTotal
) => {
    try {
        

        // Insert BillTo Party and get its ID and Address ID
        const { partyID: BillToPartyID, detailID: BillToAddressID } = await createPartyAndGetID(
            BillToPartyName, BillToPartyAddr, BillToPartyStateAndCode, BillToPartyGSTIN
        );

        // Insert ShipTo Party and get its ID and Address ID
        const { partyID: ShipToPartyID, detailID: ShipToAddressID } = await createPartyAndGetID(
            ShipToPartyName, ShipToPartyAddr, ShipToPartyStateAndCode, ShipToPartyGSTIN
        );

        // Generate unique SalesUID (could be timestamp-based or use a UUID)
        const SalesUID = generateUID();


        // Get Company Address No (DetailNo) based on CompanyAddr
        const companyAddrDoc = await currentDb.collection("TabCmpOrPartyDetails").findOne({ Addr: CompanyAddr });

        if (!companyAddrDoc) {
            console.error(`Company address code not found for your company address`);
        }

        const CompanyAddrNo = companyAddrDoc.DetailNo;


        // Insert Invoice (Master Bill) in TabSalesMaster collection
        await insertSalesMasterData(
            currentDb,
            id,
            SalesUID,
            CompanyAddrNo,
            InvNumber,
            InvNoLayout,
            MemoType,
            InvType,
            CopyType,
            BillToPartyID,
            ShipToPartyID,
            BillToAddressID,
            ShipToAddressID,
            TranspDetail,
            InvDate,
            BodyLayoutNo,
            SalesType,
            Remark,
            TotalVal,
            DiscountPer,
            DiscountRs,
            PackCharge,
            TaxableVal,
            TotalTax,
            GrandTotal
        );


        // **Predefined mandatory fields**
        const mandatoryFields = ["srNo", "productName", "hsn", "qty", "rate", "unit", "gst", "amount"];

        // **Process each item in AllItemDetails**
        for (const item of AllItemDetails) {
            let extractedValues = {};
            let extraItemValues = {}; // Change from array to object

            for (const field of FullLayout) {
                const fieldName = field.name;
                const fieldLabel = field.label; // Get label instead of name

                if (mandatoryFields.includes(fieldName)) {
                    extractedValues[fieldName] = item[fieldName];
                } else {
                    // Store extra field values as { "fieldLabel": "itemValue" } inside an object
                    extraItemValues[fieldName] = item[fieldName];
                }
            }



            // **Insert Sales Detail**
            await createSalesDetailAndGetID(
                extractedValues.productName,
                extractedValues.unit,
                extractedValues.hsn,
                extractedValues.gst,
                SalesUID,
                extractedValues.srNo,
                extractedValues.qty,
                extractedValues.rate,
                extractedValues.amount,
                extraItemValues
            );
        }

        return { message: "Invoice saved successfully" };
    } catch (error) {
        console.error("Error inserting Master Bill:", error);
        throw error;
    }
};


// Updated route
app.post("/save-invoice", async (req, res) => {
    try {
        const messages = await insertMasterBill(...Object.values(req.body)); // Pass all parameters
        res.json({ message: messages });
    } catch (error) {
        console.error("Error saving invoice:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const getData = async (collectionName, query = {}) => {
    return await getDataFromCollection(db, collectionName, query);
};

//get all party data
app.post("/getpartydata", async (req, res) => {
    try {
        const query = req.body || {}; // Fetch party data
        const parties = await getData("TabParty", query);

        // Fetch details for each party using DetailIDs
        for (let party of parties) {
            if (party.DetailIDs && party.DetailIDs.length > 0) {
                party.Details = await getData("TabCmpOrPartyDetails", { DetailNo: { $in: party.DetailIDs } });
            } else {
                party.Details = [];
            }
        }

        res.json(parties);
    } catch (error) {
        console.error("Error fetching party data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/getLatestInvoiceNo", async (req, res) => {
    try {
        const { layout } = req.body;

        if (!layout || !layout.includes('{')) {
            return res.status(400).json({ error: "Invalid layout pattern" });
        }

        const match = layout.match(/^(.*)\{(0+)\}(.*)$/);
        if (!match) {
            return res.status(400).json({ error: "Layout must contain {000}-style pattern" });
        }

        const prefix = match[1];
        const zeroPadding = match[2]; // e.g., "000"
        const suffix = match[3];

        // 🔥 Get business date range
        const businessDate = await getBusinessDateRange();

        // ✅ Fetch only invoice entries with matching layout AND within date range
        const allInvoices = await getData("TabSalesMaster", {
            InvNoLayout: layout,
            InvDate: {
                $gte: businessDate.start,
                $lte: businessDate.end
            }
        });

        // Extract number part from InvNo
        const regex = new RegExp(`^${escapeRegex(prefix)}(\\d+)${escapeRegex(suffix)}$`);
        const numbers = allInvoices.map(entry => {
            const fullNo = `${prefix}${entry.InvNo}${suffix}`;
            const match = fullNo.match(regex);
            return match ? parseInt(match[1]) : null;
        }).filter(num => num !== null);

        const maxNumber = numbers.length ? Math.max(...numbers) : 0;
        const nextNumber = maxNumber + 1;

        const padded = nextNumber.toString().padStart(zeroPadding.length, '0');
        const fullInvoiceNo = `${prefix}${padded}${suffix}`;

        res.json({
            fullInvoiceNo,
            invoiceNo: nextNumber.toString(),
            allFullInvoiceNos: numbers.map(n => `${prefix}${n.toString().padStart(zeroPadding.length, '0')}${suffix}`)
        });

    } catch (error) {
        console.error("Error in /getLatestInvoiceNo:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});




// Utility to safely escape special regex chars
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.post("/getLastBodyLayout", async (req, res) => {
    try {
        const [settings] = await getData("defaultCollection", {}, true);

        if (!settings || !settings.LastBodyLayout || !settings.BodyLayouts) {
            return res.json({ uid: '', layout: 'none' });
        }

        const layoutUID = settings.LastBodyLayout.trim();
        const bodyLayouts = {};
        for (const key in settings.BodyLayouts) {
            bodyLayouts[key.trim()] = settings.BodyLayouts[key];
        }

        const layoutData = bodyLayouts[layoutUID];

        if (!layoutData) {
            return res.json({ uid: '', layout: 'none' });
        }

        res.json({ uid: layoutUID, layout: layoutData });
    } catch (error) {
        console.error("Error in /getLastBodyLayout:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



app.post("/updateBodyLayout", async (req, res) => {
    try {
        const newLayout = req.body.layout;

        if (!Array.isArray(newLayout)) {
            return res.status(400).json({ error: "Layout must be an array" });
        }

        const [settings] = await getData("defaultCollection", {}, true); // Fix here

        if (!settings) {
            return res.status(404).json({ error: "Settings not found" });
        }

        const newBodyLayouts = settings.BodyLayouts || {};

        // Check for existing layout match
        const existingUID = Object.keys(newBodyLayouts).find(uid =>
            JSON.stringify(newBodyLayouts[uid]) === JSON.stringify(newLayout)
        );

        let finalUID = existingUID;

        // Use _id as query for update
        const query = { _id: settings._id };

        // Add new layout if not already present
        if (!existingUID) {
            finalUID = generateUID();
            newBodyLayouts[finalUID] = newLayout;
        }

        const updateObj = {
            BodyLayouts: newBodyLayouts,
            LastBodyLayout: finalUID
        };

        await updateData(currentDb, "defaultCollection", query, updateObj);

        res.json({
            success: true,
            uid: finalUID,
            layout: newBodyLayouts[finalUID],
            isNew: !existingUID
        });
    } catch (error) {
        console.error("Error in /updateBodyLayout:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



//get for party ledger
app.post("/getsalesdataforledger", async (req, res) => {
    try {
        const { id } = req.body;
        if (!currentDb) {
            return res.json([]);
        }

        let salesQuery = {};

        const { start, end } = await getBusinessDateRange();

        // 📌 1. Optional Party ID filter
        if (id) {
            salesQuery.BillToPartyUID = new ObjectId(id);
        }

        // 📌 2. Optional Date filter using InvDate (inclusive)
        if (start && end) {
            salesQuery.InvDate = { $gte: start, $lte: end };
        }

        // 📦 3. Fetch Sales Data
        const salesData = await getData("TabSalesMaster", salesQuery);

        if (!salesData.length) {
            return res.json([]);
        }

        // 🎯 4. Collect all Party and Address UIDs
        const partyUIDs = [];
        const addressUIDs = [];

        salesData.forEach(sale => {
            let billUID = sale.BillToPartyUID?.$oid || sale.BillToPartyUID?._id?.$oid || sale.BillToPartyUID;
            let shipUID = sale.ShipToPartyUID?.$oid || sale.ShipToPartyUID?._id?.$oid || sale.ShipToPartyUID;

            [billUID, shipUID].forEach(uid => {
                if (uid && !partyUIDs.includes(uid.toString())) {
                    partyUIDs.push(uid.toString());
                }
            });

            [sale.BillToAddressUID, sale.ShipToAddressUID].forEach(addrUID => {
                if (typeof addrUID === "string" && !addressUIDs.includes(addrUID)) {
                    addressUIDs.push(addrUID);
                }
            });
        });

        // 🧾 5. Fetch and map party names
        const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

        const validPartyUIDs = partyUIDs.filter(uid => isValidObjectId(uid));

        const parties = await getData("TabParty", {
            "_id": { "$in": validPartyUIDs.map(uid => new ObjectId(uid)) }
        });


        const partyMap = {};
        parties.forEach(party => {
            partyMap[party._id.toString()] = party.PartyName;
        });

        // 🏠 6. Fetch and map address details
        const addressDetails = await getData("TabCmpOrPartyDetails", {
            "DetailNo": { "$in": addressUIDs }
        });

        const addressMap = {};
        addressDetails.forEach(detail => {
            addressMap[detail.DetailNo] = detail;
        });

        // 🛠️ 7. Enrich sales data
        const enrichedSalesData = salesData.map(sale => {
            const billPartyName = sale.BillToPartyUID?.PartyName || partyMap[sale.BillToPartyUID?._id?.$oid || sale.BillToPartyUID] || null;
            const shipPartyName = sale.ShipToPartyUID?.PartyName || partyMap[sale.ShipToPartyUID?._id?.$oid || sale.ShipToPartyUID] || null;

            const billAddr = typeof sale.BillToAddressUID === "string"
                ? addressMap[sale.BillToAddressUID] || null
                : sale.BillToAddressUID;

            const shipAddr = typeof sale.ShipToAddressUID === "string"
                ? addressMap[sale.ShipToAddressUID] || null
                : sale.ShipToAddressUID;

            return {
                ...sale,
                BillToPartyName: billPartyName,
                ShipToPartyName: shipPartyName,
                BillToAddressDetails: billAddr,
                ShipToAddressDetails: shipAddr
            };
        });

        res.json(enrichedSalesData);
    } catch (error) {
        console.error("Error fetching sales data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


//make new getsalesdata
app.post("/getsalesdata", async (req, res) => {
    try {
        const { idOfSales } = req.body;

        // 1. Prepare query
        let salesQuery = {};
        if (idOfSales) {
            salesQuery._id = new ObjectId(idOfSales);
        }

        const salesData = await getData("TabSalesMaster", salesQuery);
        if (!salesData.length) return res.json([]);

        const partyUIDs = new Set();
        const addressUIDs = new Set();
        const companyAddrNos = new Set();
        const allSalesUIDs = new Set();

        salesData.forEach(sale => {
            const getUID = uidObj =>
                uidObj?.$oid || uidObj?._id?.$oid || uidObj?._id || uidObj;

            const billUID = getUID(sale.BillToPartyUID);
            const shipUID = getUID(sale.ShipToPartyUID);

            if (billUID) partyUIDs.add(billUID.toString());
            if (shipUID) partyUIDs.add(shipUID.toString());

            if (typeof sale.BillToAddressUID === "string") addressUIDs.add(sale.BillToAddressUID);
            if (typeof sale.ShipToAddressUID === "string") addressUIDs.add(sale.ShipToAddressUID);

            if (sale.CompanyAddrNo) companyAddrNos.add(sale.CompanyAddrNo);
            if (sale.SalesUID) allSalesUIDs.add(sale.SalesUID);
        });

        // 2. Fetch Party Names
        const parties = await getData("TabParty", {
            "_id": { "$in": Array.from(partyUIDs).map(uid => new ObjectId(uid)) }
        });
        const partyMap = Object.fromEntries(parties.map(p => [p._id.toString(), p.PartyName]));

        // 3. Fetch Address Details
        const addressDetails = await getData("TabCmpOrPartyDetails", {
            "DetailNo": { "$in": Array.from(addressUIDs) }
        });
        const addressMap = Object.fromEntries(addressDetails.map(a => [a.DetailNo, a]));

        // 4. Fetch Company Data
        const companies = await getData("TabCompany", {});
        const companyMap = {};
        companies.forEach(comp => {
            comp.DetailIDs?.forEach(addrNo => {
                companyMap[addrNo] = comp;
            });
        });

        // 5. Fetch all Sales Details with matching SalesUIDs
        const details = await getData("TabSalesDetail", {
            "SalesUID": { "$in": Array.from(allSalesUIDs) }
        });

        // 6. Fetch related item data
        const itemIDs = [...new Set(details.map(d => d.ItemID))].filter(Boolean).map(id => new ObjectId(id));
        const itemsData = await getData("TabItem", { "_id": { "$in": itemIDs } });

        const itemMap = {};
        itemsData.forEach(item => {
            itemMap[item._id.toString()] = item;
        });

        // Update SalesDetails with item info
        details.forEach(detail => {
            const itemInfo = itemMap[detail.ItemID];
            if (itemInfo) {
                detail.ProductName = itemInfo.ItemName || "";
                detail.HSNCode = itemInfo.HSN || "";
                detail.Unit = itemInfo.Unit || "";
                detail.GST = itemInfo.GSTPer || "";
            }
        });

        //we have salesData in which sale.CompanyAddrNo based on which we will need to go to this collection TabCmpOrPartyDetails and this is the exmple data of it
        /*
        {
          "_id": {
            "$oid": "67f397ac0c4c3e6e045684cc"
          },
          "DetailNo": "HbNtRiz",
          "Addr": "w",
          "GSTIN": "erw"
        }
        */
        // 6. Enrich and format data
        const enrichedSalesData = await Promise.all(
            salesData.map(async sale => {
                const getUID = uidObj =>
                    uidObj?.$oid || uidObj?._id?.$oid || uidObj?._id || uidObj;

                // Handle BillToParty
                const billPartyName = sale.BillToPartyUID?.PartyName
                    ? sale.BillToPartyUID.PartyName
                    : partyMap[getUID(sale.BillToPartyUID)] || null;

                // Handle ShipToParty
                const shipPartyName = sale.ShipToPartyUID?.PartyName
                    ? sale.ShipToPartyUID.PartyName
                    : partyMap[getUID(sale.ShipToPartyUID)] || null;

                // Handle BillToAddress - check if it's a string UID or embedded object
                let billAddress = null;
                if (typeof sale.BillToAddressUID === "string") {
                    // Lookup from addressMap
                    billAddress = addressMap[sale.BillToAddressUID] || null;
                } else if (sale.BillToAddressUID && typeof sale.BillToAddressUID === "object") {
                    // Use embedded object directly
                    billAddress = sale.BillToAddressUID;
                }

                // Handle ShipToAddress - check if it's a string UID or embedded object
                let shipAddress = null;
                if (typeof sale.ShipToAddressUID === "string") {
                    // Lookup from addressMap
                    shipAddress = addressMap[sale.ShipToAddressUID] || null;
                } else if (sale.ShipToAddressUID && typeof sale.ShipToAddressUID === "object") {
                    // Use embedded object directly
                    shipAddress = sale.ShipToAddressUID;
                }

                // Fetch Cmp/Party detail based on CompanyAddrNo
                const [cmpOrPartyDetail] = sale.CompanyAddrNo
                    ? await getData("TabCmpOrPartyDetails", {
                        DetailNo: sale.CompanyAddrNo
                    })
                    : [null];

                // Get BodyLayout
                const [layoutData] = sale.BodyLayoutNo
                    ? await getData("defaultCollection", {
                        [`BodyLayouts.${sale.BodyLayoutNo}`]: { $exists: true }
                    })
                    : [null];

                const matchedLayout = layoutData?.BodyLayouts?.[sale.BodyLayoutNo] || [];

                return {
                    ...sale,
                    BillToPartyName: billPartyName,
                    ShipToPartyName: shipPartyName,
                    BillToAddressDetails: billAddress,
                    ShipToAddressDetails: shipAddress,
                    CmpAddr: cmpOrPartyDetail?.Addr || null,
                    CmpGSTIN: cmpOrPartyDetail?.GSTIN || null,
                    SalesDetails: details.filter(d => d.SalesUID === sale.SalesUID),
                    BodyLayout: matchedLayout
                };
            })
        );


        res.json(enrichedSalesData);

    } catch (error) {
        console.error("Error in /getsalesdata:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



// Get all company data
app.post("/getcompanydata", async (req, res) => {
    try {
        const query = req.body || {}; // Fetch company data
        const companies = await getData("TabCompany", query);

        // Fetch details for each company using DetailIDs
        for (let company of companies) {
            if (company.DetailIDs && company.DetailIDs.length > 0) {
                company.Details = await getData("TabCmpOrPartyDetails", { DetailNo: { $in: company.DetailIDs } });
            } else {
                company.Details = [];
            }
        }

        res.json(companies);
    } catch (error) {
        console.error("Error fetching company data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/delete-receipt', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: "Receipt ID is required" });
        }

        const ObjectId = require('mongodb').ObjectId;

        // Delete from TabReceipt using the ID
        const deleteResult = await deleteData(currentDb, 'TabReceipt', { _id: new ObjectId(id) });

        res.json({ success: true, deletedCount: deleteResult });
    } catch (error) {
        console.error("Error deleting receipt:", error);
        res.status(500).json({ error: "Failed to delete receipt", details: error.message });
    }
});


app.post('/deleteaddress', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const { DetailNo, approved } = req.body;
        if (!DetailNo) {
            return res.status(400).json({ error: "DetailNo is required" });
        }

        // Fetch Address Details
        const address = await getData("TabCmpOrPartyDetails", { DetailNo });
        if (address.length === 0) {
            return res.status(404).json({ error: "Address not found" });
        }
        const addressData = address[0];

        // Check usage in SalesMaster
        const usageRecords = await getData("TabSalesMaster", {
            $or: [
                { BillToAddressUID: DetailNo },
                { ShipToAddressUID: DetailNo }
            ]
        });

        if (approved === 'false') {
            const count = usageRecords.length;
            if (count > 0) {
                return res.json({
                    requestingApproval: true,
                    message: `This address is used in ${count} bills. Deleting the address will require manual updates to these bills.`
                });
            } else {
                return proceedWithDeletion();
            }
        }

        return proceedWithDeletion();

        async function proceedWithDeletion() {
            // Replace the address ID with full data wherever used
            for (const record of usageRecords) {
                let update = {};
                if (record.BillToAddressUID === DetailNo) {
                    update.BillToAddressUID = {
                        Addr: addressData.Addr,
                        GSTIN: addressData.GSTIN,
                        PartyStateAndCode: addressData.PartyStateAndCode
                    };
                }
                if (record.ShipToAddressUID === DetailNo) {
                    update.ShipToAddressUID = {
                        Addr: addressData.Addr,
                        GSTIN: addressData.GSTIN,
                        PartyStateAndCode: addressData.PartyStateAndCode
                    };
                }

                await currentDb.collection('TabSalesMaster').updateOne(
                    { _id: record._id },
                    { $set: update }
                );
            }

            // Remove DetailNo from TabParty (if it exists)
            await currentDb.collection('TabParty').updateMany(
                { DetailIDs: DetailNo },
                { $pull: { DetailIDs: DetailNo } }
            );

            // Delete the address from TabCmpOrPartyDetails
            const deleteResult = await deleteData(currentDb, 'TabCmpOrPartyDetails', { DetailNo });

            res.json({
                success: true,
                requestingApproval: false,
                message: "Address deleted successfully and references updated.",
                updatedRecords: usageRecords.length,
                deletedAddress: deleteResult
            });
        }

    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json({ error: "Failed to delete address", details: error.message });
    }
});



app.post('/deleteparty', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const { PartyId, approved } = req.body;
        if (!PartyId) {
            return res.status(400).json({ error: "PartyId is required" });
        }

        // Fetch Party Details
        const party = await getData("TabParty", { _id: new ObjectId(PartyId) });
        if (party.length === 0) {
            return res.status(404).json({ error: "Party not found" });
        }

        // Extract only necessary party data (excluding DetailIDs)
        const { DetailIDs, ...partyData } = party[0];  // Exclude DetailIDs

        // Fetch all SalesMaster records where this PartyId is used
        const salesMasterRecords = await getData("TabSalesMaster", {
            $or: [
                { BillToPartyUID: new ObjectId(PartyId) },
                { ShipToPartyUID: new ObjectId(PartyId) }
            ]
        });

        if (approved === 'false') {
            // If the request is not approved, check if there are related bills
            const billCount = salesMasterRecords.length;
            if (billCount > 0) {
                // If there are bills, send a response that the party is used
                return res.json({
                    requestingApproval: true,
                    message: `This party is used in ${billCount} bills. Deleting the party will require manual updates to these bills.`
                });
            }else {
                // If there are no bills, proceed with deletion directly
                return proceedWithDeletion();
            }
        }

        // If approved is 'true', proceed with the deletion process
        return proceedWithDeletion();

        // Function to update sales records and delete the party
        async function proceedWithDeletion() {
            // Fetch all related addresses
            const addresses = await getData("TabCmpOrPartyDetails", { DetailNo: { $in: DetailIDs } });

            // Create a mapping of DetailNo to Address Data
            const addressMap = {};
            addresses.forEach(addr => {
                addressMap[addr.DetailNo] = {
                    Addr: addr.Addr,
                    GSTIN: addr.GSTIN,
                    PartyStateAndCode: addr.PartyStateAndCode
                };
            });

            // Loop through each sales master record and replace the IDs with full data
            for (const record of salesMasterRecords) {
                let updateData = {};

                // Replace BillToPartyUID with actual party data (excluding DetailIDs)
                if (record.BillToPartyUID.toString() === PartyId) {
                    updateData.BillToPartyUID = partyData;
                }

                // Replace ShipToPartyUID with actual party data
                if (record.ShipToPartyUID.toString() === PartyId) {
                    updateData.ShipToPartyUID = partyData;
                }

                // Replace BillToAddressUID with actual address data
                if (record.BillToAddressUID && addressMap[record.BillToAddressUID]) {
                    updateData.BillToAddressUID = addressMap[record.BillToAddressUID];
                }

                // Replace ShipToAddressUID with actual address data
                if (record.ShipToAddressUID && addressMap[record.ShipToAddressUID]) {
                    updateData.ShipToAddressUID = addressMap[record.ShipToAddressUID];
                }

                // Update the record in SalesMaster
                await currentDb.collection('TabSalesMaster').updateOne(
                    { _id: record._id },
                    { $set: updateData }
                );
            }

            // Delete Party
            const deletePartyResult = await deleteData(currentDb, 'TabParty', { _id: new ObjectId(PartyId) });

            // Delete all related addresses
            if (DetailIDs && DetailIDs.length > 0) {
                await deleteData(currentDb, 'TabCmpOrPartyDetails', { DetailNo: { $in: DetailIDs } });
            }

            res.json({
                success: true,
                requestingApproval: false,
                message: "Party deleted successfully and all references were updated.",
                updatedRecords: salesMasterRecords.length,
                deletedParty: deletePartyResult,
                deletedAddresses: DetailIDs.length
            });
        }

    } catch (error) {
        console.error("Error deleting party:", error);
        res.status(500).json({ error: "Failed to delete party", details: error.message });
    }
});




app.post('/updateaddress', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const { DetailNo, updateFields } = req.body;
        if (!DetailNo || !updateFields) {
            return res.status(400).json({ error: "DetailNo and updateFields are required" });
        }

        const updateResult = await updateData(currentDb, 'TabCmpOrPartyDetails', { DetailNo }, updateFields);

        res.json({ success: true, modifiedCount: updateResult });
    } catch (error) {
        console.error("Error updating address:", error);
        res.status(500).json({ error: "Failed to update address", details: error.message });
    }
});

app.post('/updateparty', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const { PartyId, updateFields } = req.body;
        if (!PartyId || !updateFields) {
            return res.status(400).json({ error: "PartyId and updateFields are required" });
        }

        const updateResult = await updateData(currentDb, 'TabParty', { _id: new ObjectId(PartyId) }, updateFields);

        res.json({ success: true, modifiedCount: updateResult });
    } catch (error) {
        console.error("Error updating party:", error);
        res.status(500).json({ error: "Failed to update party", details: error.message });
    }
});

app.post('/insertaddress', async (req, res) => {
    try {
        if (!currentDb) {
            console.error("Error inserting address: No currentDb");
            return res.status(500).json({ error: "Database connection not found" });
        }

        const { Addr, GSTIN, PartyStateAndCode, parentParty } = req.body;

        if (!Addr) {
            return res.status(400).json({ error: "Addr is required" });
        }

        // Generate DetailNo
        const detailNo = generateUID();

        if (!detailNo || typeof detailNo !== 'string') {
            throw new Error("Invalid detail UID");
        }

        // Insert address first
        await insertCmpOrPartyDetails(currentDb, detailNo, Addr, GSTIN, PartyStateAndCode);

        if (parentParty && parentParty !== 'none') {
            const parentObjID = new ObjectId(parentParty);

            // Fetch the full party record
            const partyDoc = await currentDb.collection('TabParty').findOne({ _id: parentObjID });
            if (!partyDoc) {
                return res.status(404).json({ error: "Party not found" });
            }

            // Delete the original record
            await currentDb.collection('TabParty').deleteOne({ _id: parentObjID });

            // Push the new detail ID
            if (!Array.isArray(partyDoc.DetailIDs)) {
                partyDoc.DetailIDs = [];
            }

            partyDoc.DetailIDs.push(detailNo);
            // Re-insert the entire updated record
            await insertPartyData(currentDb, partyDoc.PartyName, partyDoc.DetailIDs, partyDoc.PhoneNumber);
        }

        res.json({ success: true, detailNo });
    } catch (error) {
        console.error("Error inserting address:", error);
        res.status(500).json({ error: "Failed to insert address", details: error.message });
    }
});



app.post('/insertparty', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const { PartyName, DetailIDs, PhoneNumber = "" } = req.body;
        if (!PartyName || !DetailIDs) {
            return res.status(400).json({ error: "PartyName and DetailIDs are required" });
        }

        const insertResult = await insertPartyData(currentDb, PartyName, DetailIDs, PhoneNumber);

        res.json({ success: true, insertedId: insertResult });
    } catch (error) {
        console.error("Error inserting party:", error);
        res.status(500).json({ error: "Failed to insert party", details: error.message });
    }
});

//get all item data
app.post("/getitemdata", async (req, res) => {
    try {
        const data = await getData("TabItem", req.body.query || {}); // Accept query from frontend

        // Ensure each item has _id as a string
        const formattedData = data.map(item => ({
            ...item,
            _id: item._id?.$oid || item._id // Handle both cases
        }));

        res.json(formattedData);
    } catch (error) {
        console.error("Error fetching item data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Add New Item
app.post('/additem', async (req, res) => {
    try {

        const items = req.body.items || [];
        const results = [];

        for (const item of items) {
            // Remove temporary ID and flags before saving
            const { _id, isNew, isEdited, ...cleanItem } = item;
            const result = await InsertTabItemData(
                currentDb,
                cleanItem.ItemName,
                cleanItem.Unit,
                cleanItem.HSN,
                cleanItem.GSTPer
            );
            results.push(result);
        }

        res.json({ success: true, insertedIds: results });
    } catch (error) {
        console.error("Error adding items:", error);
        res.status(500).json({ error: "Failed to add items" });
    }
});

// Update Item endpoint - fixed version
app.post('/updateitem', async (req, res) => {
    try {
        // Ensure database connection
        if (!currentDb) {
            await client.connect();
            currentDb = client.db(); // Or your specific database name
        }

        

        const { query, updateFields } = req.body;  // Renamed here

        // Convert string ID to ObjectId if needed
        if (query._id && typeof query._id === 'string' && !query._id.startsWith("new-")) {
            try {
                query._id = new ObjectId(query._id);
            } catch (e) {
                console.error("Invalid ObjectId format:", query._id);
                return res.status(400).json({ error: "Invalid ID format" });
            }
        }

        // Now, call the correct update function (ensure this function exists)
        const result = await updateData(currentDb, 'TabItem', query, updateFields);


        res.json({
            success: true,
            modifiedCount: result,
            message: `Updated ${result} item(s)`
        });
    } catch (error) {
        console.error("Error updating item:", error);
        res.status(500).json({
            error: "Failed to update item",
            details: error.message
        });
    }
});

// Delete Item (fixed version)
app.post('/deleteitem', async (req, res) => {
    try {
        // Ensure connection
        if (!currentDb) {
            await connectToDatabase(currentDbName); // Replace with your actual DB name
        }

        let { query } = req.body;

        // Convert string _id to ObjectId if needed
        if (query._id && typeof query._id === 'string') {
            try {
                query._id = new ObjectId(query._id);
            } catch (e) {
                console.error("Invalid ObjectId format:", query._id);
                return res.status(400).json({ error: "Invalid ID format" });
            }
        }

        const result = await deleteData(currentDb, 'TabItem', query);
        res.json({ success: true, deletedCount: result });
    } catch (error) {
        console.error("Error deleting item:", error);
        res.status(500).json({
            error: "Failed to delete item",
            details: error.message
        });
    }
});

app.post('/save-receipt', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        const {
            _id, // optional
            receiptNo,
            receiptDate,
            partyName,
            amount,
            narration,
            isAdjustment
        } = req.body;

        if (!receiptNo || !receiptDate || !partyName || !amount) {
            return res.status(400).json({
                error: "receiptNo, receiptDate, partyName, and amount are required"
            });
        }

        const receiptAmount = parseFloat(amount);
        const dataToSave = {
            receiptNo,
            receiptDate,
            partyName,
            amount: receiptAmount,
            narration,
            isAdjustment
        };

        if (_id) {
            const modifiedCount = await updateData(
                currentDb,
                "TabReceipt",
                { _id: new ObjectId(_id) },
                dataToSave
            );

            if (modifiedCount === 0) {
                return res.status(404).json({ error: "Receipt not found or no changes detected" });
            }

            return res.json({
                success: true,
                message: "Receipt updated",
                receiptId: _id
            });
        } else {
            const collection = currentDb.collection("TabReceipt");
            const insertResult = await collection.insertOne(dataToSave);

            return res.json({
                success: true,
                message: "Receipt created",
                receiptId: insertResult.insertedId
            });
        }

    } catch (error) {
        console.error("Error saving receipt:", error);
        res.status(500).json({
            error: "Failed to save receipt",
            details: error.message
        });
    }
});

app.post('/deletesale', async (req, res) => {
    try {
        if (!currentDb) {
            await connectToDatabase(currentDbName);
        }

        let { id } = req.body;

        try {
            id = new ObjectId(id);
        } catch (e) {
            console.error("Invalid ObjectId format:", id);
            return res.status(400).json({ error: "Invalid ID format" });
        }

        // Step 1: Fetch the master document to get SalesUID
        const masterDoc = await currentDb.collection("TabSalesMaster").findOne({ _id: id });

        if (!masterDoc) {
            return res.status(404).json({ error: "Sale not found" });
        }

        const { SalesUID } = masterDoc;

        // Step 2: Delete all related details from TabSalesDetail
        const detailDeleteResult = await currentDb.collection("TabSalesDetail").deleteMany({ SalesUID });

        // Step 3: Delete master document
        const masterDeleteResult = await currentDb.collection("TabSalesMaster").deleteOne({ _id: id });

        if (masterDeleteResult.deletedCount === 0) {
            return res.status(404).json({ error: "Failed to delete master sale record" });
        }

        res.json({
            success: true,
            deletedMasterCount: masterDeleteResult.deletedCount,
            deletedDetailCount: detailDeleteResult.deletedCount
        });

    } catch (error) {
        console.error("Error deleting sale:", error);
        res.status(500).json({
            error: "Failed to delete sale",
            details: error.message
        });
    }
});

const getBusinessDateRange = async () => {
    try {
        if (!currentDb && currentDbName) {
            await connectToDatabase(currentDbName);
        }

        if (!currentDb) {
            throw new Error("No database connection found.");
        }

        const defaultDoc = await currentDb.collection("defaultCollection").findOne({});
        const businessDate = defaultDoc?.BusinessDate;

        if (!businessDate || !businessDate.start || !businessDate.end) {
            throw new Error("Business date not properly set in defaultCollection.");
        }

        return businessDate;
    } catch (error) {
        console.error("Error fetching business date:", error);

        // Fallback to today's date
        const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        return {
            start: today,
            end: today
        };
    }
};


// Get all receipt data with optional date filtering
app.post("/getreceiptdata", async (req, res) => {
    try {
        if (!currentDb) {
            return res.json([]); // 🔁 Add return to prevent further execution
        }

        const { _id } = req.body || {};
        const query = {};

        if (_id && typeof _id === "string") {
            query._id = new ObjectId(_id);
        }

        const { start, end } = await getBusinessDateRange();
        query.receiptDate = { $gte: start, $lte: end };

        const receipts = await getData("TabReceipt", query);
        res.json(receipts);
    } catch (error) {
        console.error("Error fetching receipt data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.post("/getbusinessdate", async (req, res) => {
    try {
        const result = await getData("defaultCollection", { _id: new ObjectId("67f51545df234b66f2876ad2") });
        if (result.length) {
            res.json({ businessDate: result[0].BusinessDate || null });
        } else {
            res.status(404).json({ error: "Document not found" });
        }
    } catch (err) {
        console.error("Error getting business date:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.post("/setbusinessdate", async (req, res) => {
    try {
        const { start, end } = req.body;

        if (!start || !end) {
            return res.status(400).json({ error: "Missing start or end date" });
        }

        const query = { _id: new ObjectId("67f51545df234b66f2876ad2") };

        const result = await updateData(currentDb, "defaultCollection", query, {
            BusinessDate: { start, end }
        });

        res.json({ success: true, updated: result });
    } catch (err) {
        console.error("Error setting business date:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



app.post("/GetInvoiceNoLayout", async (req, res) => {
    try {
        const data = await currentDb.collection("defaultCollection").findOne({});
        const layout = data?.InvoiceNoLayout || [];

        res.json({ InvoiceNoLayout: layout });
    } catch (error) {
        console.error("Error fetching InvoiceNoLayout:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/UpdateInvoiceNoLayout", async (req, res) => {
    try {
        const newLayout = req.body.newLayout;

        if (!newLayout) {
            return res.status(400).json({ error: "newLayout is required in body." });
        }

        const collection = currentDb.collection("defaultCollection");

        const existing = await collection.findOne({ InvoiceNoLayout: { $exists: true } });

        if (existing && existing.InvoiceNoLayout.includes(newLayout)) {
            return res.json({ message: "Layout already exists. No update performed." });
        }

        await collection.updateOne(
            {},
            { $addToSet: { InvoiceNoLayout: newLayout } }, // $addToSet prevents duplicates
            { upsert: true }
        );

        res.json({ message: "Layout updated successfully." });
    } catch (error) {
        console.error("Error updating InvoiceNoLayout:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Start server
const PORT = process.env.NODE_PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

