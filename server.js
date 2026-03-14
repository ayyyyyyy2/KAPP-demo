const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 3018;

// MongoDB Atlas connection with new cluster - targeting demo.users database
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://straightouttaaside:nSTkA3ipZ5gJZO4W@cluster0.ncuhort.mongodb.net/demo?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User schema
const userSchema = new mongoose.Schema({
    regd_no: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'teacher', 'user'],
        default: 'user'
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    points: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Offers schema
// Update the Offer schema to include claimedAt field
const offerSchema = new mongoose.Schema({
    offer_id: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    sent_by: {
        type: String,
        required: true
    },
    receiver_email: {
        type: String,
        required: true
    },
    points_amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'claimed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    claimedAt: {
        type: Date
    }
});

// Add Reward Schema
const rewardSchema = new mongoose.Schema({
    reward_id: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    cost: {
        type: Number,
        required: true
    },
    vendor: {
        type: String,
        required: true
    },
    image_url: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema, 'users');
const Offer = mongoose.model('Offer', offerSchema, 'offers');
const Reward = mongoose.model('Reward', rewardSchema, 'rewards');

// Middleware
// Updated configuration with increased limits
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle registration form submission
app.post('/register', async (req, res) => {
    try {
        console.log('Registration request received:', req.body);
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields (name, email, password) are required'
            });
        }
        
        const lastUser = await User.findOne().sort({ regd_no: -1 });
        let nextRegdNo = '1';
        
        if (lastUser && lastUser.regd_no) {
            const lastRegdNo = parseInt(lastUser.regd_no);
            nextRegdNo = (lastRegdNo + 1).toString();
        }
        
        console.log('Generated registration number:', nextRegdNo); // Add logging
        
        // Create new user with auto-generated registration number
        const newUser = new User({
            regd_no: nextRegdNo,
            name,
            email,
            password,
            points: 0
        });
        
        await newUser.save();
        console.log('User saved successfully:', newUser.regd_no); // Add logging
        
        res.json({
            success: true,
            message: `Registration successful! Your registration number is: ${nextRegdNo}`,
            user: {
                regd_no: newUser.regd_no,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                points: newUser.points
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error); // Add detailed logging
        if (error.code === 11000) {
            // Duplicate key error (email already exists)
            const field = Object.keys(error.keyPattern)[0];
            res.status(400).json({
                success: false,
                message: `${field === 'email' ? 'Email' : 'Registration number'} already exists`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Registration failed: ' + error.message,
                error: error.message
            });
        }
    }
});

// Handle login form submission
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email and password
        const user = await User.findOne({ 
            email: email, 
            password: password 
        });
        
        if (user) {
            // Determine dashboard based on role
            let dashboardPage;
            switch(user.role) {
                case 'admin':
                    dashboardPage = 'dashboard-admin';
                    break;
                case 'teacher':
                    dashboardPage = 'dashboard-teacher';
                    break;
                case 'user':
                default:
                    dashboardPage = 'dashboard-student';
                    break;
            }
            
            const redirectUrl = `/${dashboardPage}?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&regd_no=${encodeURIComponent(user.regd_no)}&role=${encodeURIComponent(user.role)}&points=${encodeURIComponent(user.points || 0)}`;
            res.redirect(redirectUrl);
        } else {
            res.status(401).send(`
                <script>
                    alert('Invalid email or password. Please check your credentials or register first.');
                    window.location.href = '/';
                </script>
            `);
        }
    } catch (error) {
        res.status(500).send(`
            <script>
                alert('Login failed: ${error.message}');
                window.location.href = '/';
            </script>
        `);
    }
});

// Create offer
app.post('/create-offer', async (req, res) => {
    try {
        const { title, description, sent_by, receiver_email, points_amount } = req.body;
        
        // Validate receiver email exists
        const receiver = await User.findOne({ email: receiver_email });
        if (!receiver) {
            return res.status(400).json({
                success: false,
                message: 'Receiver email not found'
            });
        }
        
        // Generate unique offer ID with proper numeric sorting
        const offers = await Offer.find({}, { offer_id: 1 }).lean();
        let nextOfferId = '1';
        
        if (offers.length > 0) {
            // Convert offer_ids to numbers, sort numerically, and get the highest
            const numericIds = offers
                .map(offer => parseInt(offer.offer_id))
                .filter(id => !isNaN(id))
                .sort((a, b) => b - a); // Sort in descending order
            
            if (numericIds.length > 0) {
                nextOfferId = (numericIds[0] + 1).toString();
            }
        }
        
        const newOffer = new Offer({
            offer_id: nextOfferId,
            title,
            description,
            sent_by,
            receiver_email,
            points_amount: parseInt(points_amount)
        });
        
        await newOffer.save();
        
        res.json({
            success: true,
            message: 'Offer created successfully!',
            offer: newOffer
        });
        
    } catch (error) {
        console.error('Create offer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create offer: ' + error.message
        });
    }
});

// Get offers for user
app.get('/get-offers/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const offers = await Offer.find({ 
            receiver_email: email,
            status: 'pending'
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            offers: offers
        });
        
    } catch (error) {
        console.error('Get offers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get offers: ' + error.message
        });
    }
});

// Update the claim offer endpoint
app.post('/claim-offer', async (req, res) => {
    try {
        const { offer_id, user_email } = req.body;
        
        // Find the offer
        const offer = await Offer.findOne({ 
            offer_id: offer_id,
            receiver_email: user_email,
            status: 'pending'
        });
        
        if (!offer) {
            return res.status(400).json({
                success: false,
                message: 'Offer not found or already claimed'
            });
        }
        
        // Update user points
        const user = await User.findOne({ email: user_email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.points = (user.points || 0) + offer.points_amount;
        await user.save();
        
        // Mark offer as claimed and set claimedAt timestamp
        offer.status = 'claimed';
        offer.claimedAt = new Date();
        await offer.save();
        
        res.json({
            success: true,
            message: `Successfully claimed ${offer.points_amount} points!`,
            new_points: user.points
        });
        
    } catch (error) {
        console.error('Claim offer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to claim offer: ' + error.message
        });
    }
});

// Get user points
app.get('/get-points/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const user = await User.findOne({ email: email });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            points: user.points || 0
        });
        
    } catch (error) {
        console.error('Get points error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get points: ' + error.message
        });
    }
});

// Get all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

// Get claimed offers history for user
// Fixed version:
app.get('/get-claimed-offers/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const claimedOffers = await Offer.find({ 
            receiver_email: email,
            status: 'claimed'
        }).sort({ claimedAt: -1 }); // Sort by when claimed, not when created
        
        res.json({
            success: true,
            offers: claimedOffers
        });
        
    } catch (error) {
        console.error('Get claimed offers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get claimed offers: ' + error.message
        });
    }
});

// Get all offers from demo.offers collection
app.get('/get-all-offers', async (req, res) => {
    try {
        const allOffers = await Offer.find({}).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            total: allOffers.length,
            offers: allOffers
        });
        
    } catch (error) {
        console.error('Get all offers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get all offers: ' + error.message
        });
    }
});

// Serve role-specific dashboard pages
app.get('/dashboard-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard-admin.html'));
});

app.get('/dashboard-teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard-teacher.html'));
});

app.get('/dashboard-student', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard-student.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Add new route for All Vendors page (admin only)
app.get('/all-vendors', (req, res) => {
    res.sendFile(path.join(__dirname, 'all-vendors.html'));
});

// Add new route for Hog's Head page
app.get('/hogshead', (req, res) => {
    res.sendFile(path.join(__dirname, 'hogshead.html'));
});

// Add new route for Żona Krawca page
app.get('/zonakrawca', (req, res) => {
    res.sendFile(path.join(__dirname, 'zonakrawca.html'));
});

// Add new route for All Rewards page
app.get('/all-rewards', (req, res) => {
    res.sendFile(path.join(__dirname, 'all-rewards.html'));
});

// MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('✅ Connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.log('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

// Start server - only run locally
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📝 Registration form available at http://localhost:${PORT}`);
    });
}

// Create reward
app.post('/create-reward', async (req, res) => {
    try {
        const { title, description, cost, vendor, image_url } = req.body;
        
        // Generate unique reward ID
        const lastReward = await Reward.findOne().sort({ reward_id: -1 });
        let nextRewardId = '1';
        
        if (lastReward && lastReward.reward_id) {
            const lastRewardId = parseInt(lastReward.reward_id);
            nextRewardId = (lastRewardId + 1).toString();
        }
        
        const newReward = new Reward({
            reward_id: nextRewardId,
            title,
            description,
            cost: parseInt(cost),
            vendor,
            image_url: image_url || null
        });
        
        await newReward.save();
        
        res.json({
            success: true,
            message: 'Reward created successfully!',
            reward: newReward
        });
        
    } catch (error) {
        console.error('Create reward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create reward: ' + error.message
        });
    }
});

// Get rewards by vendor
app.get('/get-rewards/:vendor', async (req, res) => {
    try {
        const { vendor } = req.params;
        const rewards = await Reward.find({ 
            vendor: vendor
            // Remove status filter to get both active and inactive
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            rewards: rewards
        });
        
    } catch (error) {
        console.error('Get rewards error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get rewards: ' + error.message
        });
    }
});

// Get all active rewards for all-rewards page
app.get('/get-all-rewards', async (req, res) => {
    try {
        const rewards = await Reward.find({ status: 'active' }).sort({ createdAt: -1 });
        res.json(rewards);
    } catch (error) {
        console.error('Error fetching all rewards:', error);
        res.status(500).json({ error: 'Failed to fetch rewards' });
    }
});

// Add endpoint to deactivate reward
app.post('/deactivate-reward', async (req, res) => {
    try {
        const { reward_id } = req.body;
        
        const reward = await Reward.findOne({ reward_id: reward_id });
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }
        
        reward.status = 'inactive';
        await reward.save();
        
        res.json({
            success: true,
            message: 'Reward deactivated successfully'
        });
        
    } catch (error) {
        console.error('Deactivate reward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate reward: ' + error.message
        });
    }
});

app.post('/reactivate-reward', async (req, res) => {
    try {
        const { reward_id } = req.body;
        
        const reward = await Reward.findOne({ reward_id: reward_id });
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }
        
        reward.status = 'active';
        await reward.save();
        
        res.json({
            success: true,
            message: 'Reward reactivated successfully'
        });
        
    } catch (error) {
        console.error('Reactivate reward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reactivate reward: ' + error.message
        });
    }
});

// Add this endpoint after the existing endpoints (around line 770)
app.get('/get-claimed-rewards/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const claimedRewards = await ClaimedReward.find({ 
            user_email: email
        }).sort({ claimedAt: -1 }); // Sort by most recent first
        
        res.json({
            success: true,
            claimed_rewards: claimedRewards
        });
        
    } catch (error) {
        console.error('Get claimed rewards error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get claimed rewards: ' + error.message
        });
    }
});

// Add this after the existing schemas (around line 129)
const claimedRewardSchema = new mongoose.Schema({
    claim_id: {
        type: String,
        required: true,
        unique: true
    },
    reward_id: {
        type: String,
        required: true
    },
    user_email: {
        type: String,
        required: true
    },
    user_name: {
        type: String,
        required: true
    },
    reward_title: {
        type: String,
        required: true
    },
    reward_cost: {
        type: Number,
        required: true
    },
    vendor: {
        type: String,
        required: true
    },
    claimedAt: {
        type: Date,
        default: Date.now
    }
});

// Counter schema to generate sequential IDs safely
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema, 'counters');

const ClaimedReward = mongoose.model('ClaimedReward', claimedRewardSchema, 'rewards_claimed');

// Add this new endpoint before the final closing bracket (around line 654)
app.post('/claim-reward', async (req, res) => {
    try {
        const { reward_id, user_email, user_name } = req.body;
        
        // Find the reward
        const reward = await Reward.findOne({ 
            reward_id: reward_id,
            status: 'active'
        });
        
        if (!reward) {
            return res.status(400).json({
                success: false,
                message: 'Reward not found or inactive'
            });
        }
        
        // Find the user
        const user = await User.findOne({ email: user_email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if user has enough points
        if (user.points < reward.cost) {
            return res.status(400).json({
                success: false,
                message: `Insufficient points. You need ${reward.cost} points but only have ${user.points}.`
            });
        }
        
        // Generate unique claim ID using atomic counter (avoids string sort issues)
        // First, ensure the counter is at least the current max in the collection
        const maxDoc = await ClaimedReward.aggregate([
            { $addFields: { claim_id_num: { $toInt: '$claim_id' } } },
            { $sort: { claim_id_num: -1 } },
            { $limit: 1 },
            { $project: { claim_id_num: 1 } }
        ]);
        const currentMax = (maxDoc[0] && maxDoc[0].claim_id_num) ? maxDoc[0].claim_id_num : 0;
        await Counter.updateOne(
            { _id: 'claimedReward' },
            { $max: { seq: currentMax } },
            { upsert: true }
        );
        const counter = await Counter.findOneAndUpdate(
            { _id: 'claimedReward' },
            { $inc: { seq: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const nextClaimId = String(counter.seq);
        console.log('Generated claim_id for reward claim:', nextClaimId);
        
        // Deduct points from user
        user.points = user.points - reward.cost;
        await user.save();
        
        // Create claimed reward record
        const claimedReward = new ClaimedReward({
            claim_id: nextClaimId,
            reward_id: reward.reward_id,
            user_email: user_email,
            user_name: user_name,
            reward_title: reward.title,
            reward_cost: reward.cost,
            vendor: reward.vendor
        });
        
        await claimedReward.save();
        
        res.json({
            success: true,
            message: `Successfully claimed ${reward.title}! ${reward.cost} points deducted.`,
            new_points: user.points,
            claimed_reward: claimedReward
        });
        
    } catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to claim reward: ' + error.message
        });
    }
});

module.exports = app;
