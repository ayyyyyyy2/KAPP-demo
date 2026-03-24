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
    pointsHistory: [{
        amount: Number,
        type: { type: String }, // 'sent_offer', 'claimed_offer', 'reward_claim'
        description: String,
        timestamp: { type: Date, default: Date.now }
    }],
    avatar: {
        hat: { type: String, default: 'none' },
        shirt: { type: String, default: 'default' },
        hairStyle: { type: String, default: 'none' },
        hairColor: { type: String, default: '#000000' }
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

// Counter schema to generate sequential IDs safely
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema, 'counters');

// Middleware
// Updated configuration with increased limits
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Handle avatar update
app.post('/api/update-avatar', async (req, res) => {
    try {
        const { email, avatar } = req.body;
        console.log('🔄 Avatar update request for:', email, 'Data:', avatar);
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await User.findOneAndUpdate(
            { email: email },
            { avatar: avatar },
            { new: true }
        );
        
        if (user) {
            console.log('✅ Avatar updated for:', email);
            res.json({ success: true, avatar: user.avatar });
        } else {
            console.log('❌ User not found for avatar update:', email);
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('❌ Update avatar error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

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
        
        // Generate unique registration number using atomic counter
        // Scalable approach: only check User collection if counter doesn't exist
        let counter = await Counter.findOne({ _id: 'userRegistration' });
        
        if (!counter) {
            // First time setup or counter lost: sync with existing users
            const maxUser = await User.aggregate([
                { $addFields: { regd_no_num: { $toInt: '$regd_no' } } },
                { $sort: { regd_no_num: -1 } },
                { $limit: 1 },
                { $project: { regd_no_num: 1 } }
            ]);
            const currentMax = (maxUser[0] && maxUser[0].regd_no_num) ? maxUser[0].regd_no_num : 0;
            counter = await Counter.findOneAndUpdate(
                { _id: 'userRegistration' },
                { $setOnInsert: { seq: currentMax } },
                { upsert: true, new: true }
            );
        }

        // Atomically increment and get new ID
        counter = await Counter.findOneAndUpdate(
            { _id: 'userRegistration' },
            { $inc: { seq: 1 } },
            { new: true }
        );
        const nextRegdNo = String(counter.seq);
        
        console.log('Generated registration number:', nextRegdNo); // Add logging
        
        // Create new user with auto-generated registration number
        const newUser = new User({
            regd_no: nextRegdNo,
            name,
            email,
            password,
            points: 0,
            avatar: {
                hat: 'none',
                shirt: 'default',
                hairStyle: 'none',
                hairColor: '#000000'
            }
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
            
            const avatarData = JSON.stringify(user.avatar || { hat: 'none', shirt: 'default', hairStyle: 'none', hairColor: '#000000' });
            const redirectUrl = `/${dashboardPage}?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&regd_no=${encodeURIComponent(user.regd_no)}&role=${encodeURIComponent(user.role)}&points=${encodeURIComponent(user.points || 0)}&avatar=${encodeURIComponent(avatarData)}`;
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
        const amount = parseInt(points_amount);
        
        // Validate receiver email exists
        const receiver = await User.findOne({ email: receiver_email });
        if (!receiver) {
            return res.status(400).json({
                success: false,
                message: 'Receiver email not found'
            });
        }
        
        // Find the sender and deduct points (only for 'user' role, or if you want it for everyone)
        const sender = await User.findOne({ regd_no: sent_by });
        if (!sender) {
            return res.status(400).json({
                success: false,
                message: 'Sender not found'
            });
        }
        
        // Admin: unlimited points (no balance check and no deduction)
        if (sender.role === 'admin') {
            sender.pointsHistory.push({
                amount: -amount,
                type: 'sent_offer',
                description: `Sent offer: ${title} to ${receiver.name}`,
                timestamp: new Date()
            });
            await sender.save();
        } else if (sender.role === 'user') {
            if ((sender.points || 0) < amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Not enough points'
                });
            }
            
            sender.points -= amount;
            sender.pointsHistory.push({
                amount: -amount,
                type: 'sent_offer',
                description: `Sent offer: ${title} to ${receiver.name}`,
                timestamp: new Date()
            });
            await sender.save();
        } else {
            // For teachers/admins, still record the history but don't deduct if they have unlimited
            // Or if they have a balance, deduct it too. Let's assume teachers also have a balance for now.
            // If the user wants teachers to have unlimited, we can adjust this.
            // For now, let's treat everyone equally for simplicity unless told otherwise.
            if ((sender.points || 0) < amount) {
                // If teachers have unlimited, skip this check.
                // But let's assume everyone has a balance for consistency.
                return res.status(400).json({
                    success: false,
                    message: 'Not enough points'
                });
            }
            sender.points -= amount;
            sender.pointsHistory.push({
                amount: -amount,
                type: 'sent_offer',
                description: `Sent offer: ${title} to ${receiver.name}`,
                timestamp: new Date()
            });
            await sender.save();
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
            points_amount: amount
        });
        
        await newOffer.save();
        
        res.json({
            success: true,
            message: 'Offer created successfully!',
            offer: newOffer,
            new_points: sender.points
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
        const offers = await Offer.aggregate([
            { $match: { receiver_email: email, status: 'pending' } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sent_by',
                    foreignField: 'regd_no', // Changed from 'email' to 'regd_no' to correctly find user name
                    as: 'senderInfo'
                }
            },
            {
                $unwind: {
                    path: '$senderInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    offer_id: 1,
                    title: 1,
                    description: 1,
                    points_amount: 1,
                    sent_by: { $ifNull: ['$senderInfo.name', '$sent_by'] }, // Use name if found, else original email
                    createdAt: 1
                }
            },
            { $sort: { createdAt: -1 } }
        ]);
        
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
        
        // Find sender to get name for history
        const sender = await User.findOne({ regd_no: offer.sent_by });
        const senderName = sender ? sender.name : 'Unknown';
        
        user.points = (user.points || 0) + offer.points_amount;
        user.pointsHistory.push({
            amount: offer.points_amount,
            type: 'claimed_offer',
            description: `Received points from ${senderName}: ${offer.title}`,
            timestamp: new Date()
        });
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
        
        if (user.role === 'admin') {
            return res.json({
                success: true,
                points: null,
                unlimited: true
            });
        }

        res.json({
            success: true,
            points: user.points || 0,
            unlimited: false
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

app.get('/get-points-history/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const user = await User.findOne({ email: email }, { pointsHistory: 1 });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Sort history by timestamp descending
        const history = (user.pointsHistory || []).sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({
            success: true,
            history: history
        });
        
    } catch (error) {
        console.error('Get points history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get points history: ' + error.message
        });
    }
});

// Get claimed offers history for user
// Fixed version:
app.get('/get-claimed-offers/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const claimedOffers = await Offer.aggregate([
            { $match: { receiver_email: email, status: 'claimed' } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sent_by',
                    foreignField: 'regd_no',
                    as: 'senderInfo'
                }
            },
            {
                $unwind: {
                    path: '$senderInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    offer_id: 1,
                    title: 1,
                    description: 1,
                    points_amount: 1,
                    sent_by: { $ifNull: ['$senderInfo.name', '$sent_by'] },
                    claimedAt: 1,
                    createdAt: 1
                }
            },
            { $sort: { claimedAt: -1 } }
        ]);
        
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
        const allOffers = await Offer.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'sent_by',
                    foreignField: 'regd_no',
                    as: 'senderInfo'
                }
            },
            {
                $unwind: {
                    path: '$senderInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    offer_id: 1,
                    title: 1,
                    description: 1,
                    points_amount: 1,
                    sent_by: { $ifNull: ['$senderInfo.name', '$sent_by'] },
                    receiver_email: 1,
                    status: 1,
                    createdAt: 1
                }
            },
            { $sort: { createdAt: -1 } }
        ]);
        
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
        
        // Generate unique reward ID using atomic counter
        // Scalable approach: only check Reward collection if counter doesn't exist
        let counter = await Counter.findOne({ _id: 'rewardCreation' });
        
        if (!counter) {
            // First time setup or counter lost: sync with existing rewards
            const maxReward = await Reward.aggregate([
                { $addFields: { reward_id_num: { $toInt: '$reward_id' } } },
                { $sort: { reward_id_num: -1 } },
                { $limit: 1 },
                { $project: { reward_id_num: 1 } }
            ]);
            const currentMax = (maxReward[0] && maxReward[0].reward_id_num) ? maxReward[0].reward_id_num : 0;
            counter = await Counter.findOneAndUpdate(
                { _id: 'rewardCreation' },
                { $setOnInsert: { seq: currentMax } },
                { upsert: true, new: true }
            );
        }

        // Atomically increment and get new ID
        counter = await Counter.findOneAndUpdate(
            { _id: 'rewardCreation' },
            { $inc: { seq: 1 } },
            { new: true }
        );
        const nextRewardId = String(counter.seq);
        
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

// Update reward endpoint
app.post('/update-reward', async (req, res) => {
    try {
        const { reward_id, title, description, cost, image_url } = req.body;
        
        const reward = await Reward.findOne({ reward_id: reward_id });
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }
        
        if (title) reward.title = title;
        if (description) reward.description = description;
        if (cost) reward.cost = parseInt(cost);
        if (image_url !== undefined) reward.image_url = image_url;
        
        await reward.save();
        
        res.json({
            success: true,
            message: 'Reward updated successfully!',
            reward: reward
        });
        
    } catch (error) {
        console.error('Update reward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update reward: ' + error.message
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
        const claimedRewards = await ClaimedReward.aggregate([
            { $match: { user_email: email } },
            {
                $addFields: {
                    reward_id_str: { $toString: '$reward_id' }
                }
            },
            {
                $lookup: {
                    from: 'rewards',
                    localField: 'reward_id_str',
                    foreignField: 'reward_id',
                    as: 'rewardDetails'
                }
            },
            {
                $unwind: {
                    path: '$rewardDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    claim_id: 1,
                    reward_id: 1,
                    user_email: 1,
                    user_name: 1,
                    reward_title: 1,
                    reward_cost: 1,
                    vendor: 1,
                    claimedAt: 1,
                    image_url: '$rewardDetails.image_url'
                }
            },
            { $sort: { claimedAt: -1 } }
        ]);
        
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
        
        if (user.role !== 'admin') {
            // Check if user has enough points
            if (user.points < reward.cost) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient points. You need ${reward.cost} points but only have ${user.points}.`
                });
            }
        }
        
        // Generate unique claim ID using atomic counter
        // Scalable approach: only check ClaimedReward collection if counter doesn't exist
        let counterDoc = await Counter.findOne({ _id: 'claimedReward' });
        
        if (!counterDoc) {
            // First time setup or counter lost: sync with existing claimed rewards
            const maxDoc = await ClaimedReward.aggregate([
                { $addFields: { claim_id_num: { $toInt: '$claim_id' } } },
                { $sort: { claim_id_num: -1 } },
                { $limit: 1 },
                { $project: { claim_id_num: 1 } }
            ]);
            const currentMax = (maxDoc[0] && maxDoc[0].claim_id_num) ? maxDoc[0].claim_id_num : 0;
            counterDoc = await Counter.findOneAndUpdate(
                { _id: 'claimedReward' },
                { $setOnInsert: { seq: currentMax } },
                { upsert: true, new: true }
            );
        }

        // Atomically increment and get new ID
        counterDoc = await Counter.findOneAndUpdate(
            { _id: 'claimedReward' },
            { $inc: { seq: 1 } },
            { new: true }
        );
        const nextClaimId = String(counterDoc.seq);
        console.log('Generated claim_id for reward claim:', nextClaimId);
        
        if (user.role !== 'admin') {
            // Deduct points from user
            user.points = user.points - reward.cost;
        }
        user.pointsHistory.push({
            amount: -reward.cost,
            type: 'reward_claim',
            description: `Claimed reward: ${reward.title}`,
            timestamp: new Date()
        });
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
            message: `Successfully claimed ${reward.title}!`,
            new_points: user.role === 'admin' ? null : user.points,
            unlimited: user.role === 'admin',
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
