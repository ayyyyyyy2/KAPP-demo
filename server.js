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
    analytics: {
        totalTimeSpentSeconds: {
            type: Number,
            default: 0
        },
        dailySessions: {
            type: Object,
            default: {}
        }
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
        default: null
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

const notificationSchema = new mongoose.Schema({
    notification_id: {
        type: String,
        required: true,
        unique: true
    },
    sender_email: {
        type: String,
        required: true
    },
    sender_name: {
        type: String,
        required: true
    },
    target_email: {
        type: String,
        default: null
    },
    target_emails: {
        type: [String],
        default: []
    },
    headline: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    animation: {
        type: String,
        enum: ['bounce', 'slide', 'glow'],
        default: 'bounce'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema, 'users');
const Offer = mongoose.model('Offer', offerSchema, 'offers');
const Reward = mongoose.model('Reward', rewardSchema, 'rewards');
const Notification = mongoose.model('Notification', notificationSchema, 'notifications');

// Counter schema to generate sequential IDs safely
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema, 'counters');

function getAnalyticsDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function ensureUserAnalytics(user) {
    if (!user.analytics || typeof user.analytics !== 'object') {
        user.analytics = {};
    }
    if (!Number.isFinite(user.analytics.totalTimeSpentSeconds)) {
        user.analytics.totalTimeSpentSeconds = 0;
    }
    if (!user.analytics.dailySessions || typeof user.analytics.dailySessions !== 'object') {
        user.analytics.dailySessions = {};
    }
    return user.analytics;
}

function incrementDailySessionCount(user, date = new Date()) {
    const analytics = ensureUserAnalytics(user);
    const dateKey = getAnalyticsDateKey(date);
    analytics.dailySessions[dateKey] = Number(analytics.dailySessions[dateKey] || 0) + 1;
    user.markModified('analytics');
}

function addTrackedTime(user, seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!safeSeconds) {
        return;
    }
    const analytics = ensureUserAnalytics(user);
    analytics.totalTimeSpentSeconds = Number(analytics.totalTimeSpentSeconds || 0) + safeSeconds;
    user.markModified('analytics');
}

async function getUserBananaTotals(user) {
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const regdNo = String(user?.regd_no || '').trim();
    const bonusBananas = Array.isArray(user?.pointsHistory)
        ? user.pointsHistory.reduce((total, entry) => {
            const amount = Number(entry?.amount || 0);
            return ['snake_banana', 'roadmap_aplus_bonus'].includes(entry?.type) && amount > 0
                ? total + amount
                : total;
        }, 0)
        : 0;

    const [claimedOffers, sentOffers, claimedRewards] = await Promise.all([
        userEmail ? Offer.aggregate([
            { $match: { receiver_email: userEmail, status: 'claimed' } },
            { $group: { _id: null, total: { $sum: '$points_amount' } } }
        ]) : Promise.resolve([]),
        regdNo ? Offer.aggregate([
            { $match: { sent_by: regdNo, status: 'claimed' } },
            { $group: { _id: null, total: { $sum: '$points_amount' } } }
        ]) : Promise.resolve([]),
        userEmail ? ClaimedReward.aggregate([
            { $match: { user_email: userEmail } },
            { $group: { _id: null, total: { $sum: '$reward_cost' } } }
        ]) : Promise.resolve([])
    ]);

    const bananasClaimed = Number(claimedOffers[0]?.total || 0);
    const bananasSpentOnOffers = Number(sentOffers[0]?.total || 0);
    const bananasSpentOnRewards = Number(claimedRewards[0]?.total || 0);

    return {
        bananas_claimed: bananasClaimed + bonusBananas,
        bananas_spent: bananasSpentOnOffers + bananasSpentOnRewards
    };
}

async function buildAnalyticsSnapshot(user, todayKey = getAnalyticsDateKey()) {
    const totals = await getUserBananaTotals(user);
    return {
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        time_spent_seconds: Number(user.analytics?.totalTimeSpentSeconds || 0),
        daily_sessions: Number(user.analytics?.dailySessions?.[todayKey] || 0),
        bananas_claimed: totals.bananas_claimed,
        bananas_spent: totals.bananas_spent,
        roadmap_aplus_claimed: Array.isArray(user?.pointsHistory)
            ? user.pointsHistory.some((entry) => entry?.type === 'roadmap_aplus_bonus')
            : false
    };
}
const notificationClients = new Map();

function serializeNotification(notification) {
    return {
        id: notification.notification_id,
        sender_email: notification.sender_email,
        sender_name: notification.sender_name,
        target_email: notification.target_email,
        target_emails: Array.isArray(notification.target_emails) ? notification.target_emails : [],
        headline: notification.headline,
        message: notification.message,
        animation: notification.animation,
        createdAt: notification.createdAt
    };
}

function addNotificationClient(email, res) {
    if (!notificationClients.has(email)) {
        notificationClients.set(email, new Set());
    }
    notificationClients.get(email).add(res);
}

function removeNotificationClient(email, res) {
    if (!notificationClients.has(email)) {
        return;
    }
    const clients = notificationClients.get(email);
    clients.delete(res);
    if (clients.size === 0) {
        notificationClients.delete(email);
    }
}

async function broadcastNotification(notificationDoc) {
    const payload = `data: ${JSON.stringify(serializeNotification(notificationDoc))}\n\n`;
    let recipientEmails = [];

    if (Array.isArray(notificationDoc.target_emails) && notificationDoc.target_emails.length > 0) {
        recipientEmails = notificationDoc.target_emails;
    } else if (notificationDoc.target_email) {
        recipientEmails = [notificationDoc.target_email];
    } else {
        const users = await User.find({ role: { $ne: 'admin' } }).select('email -_id');
        recipientEmails = users.map((user) => user.email);
    }

    for (const email of recipientEmails) {
        const clients = notificationClients.get(email);
        if (!clients) {
            continue;
        }
        for (const client of clients) {
            client.write(payload);
        }
    }
}

function getActiveUserEmails() {
    return Array.from(notificationClients.keys()).filter(Boolean);
}

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
            incrementDailySessionCount(user);
            await user.save();

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

app.post('/analytics/session', async (req, res) => {
    try {
        const userEmail = String(req.body.user_email || '').trim().toLowerCase();
        const durationSeconds = Math.min(300, Math.max(0, Math.floor(Number(req.body.duration_seconds) || 0)));

        if (!userEmail || !durationSeconds) {
            return res.json({ success: true });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        addTrackedTime(user, durationSeconds);
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Analytics session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save analytics session'
        });
    }
});

app.post('/snake-banana-claim', async (req, res) => {
    try {
        const userEmail = String(req.body.user_email || '').trim().toLowerCase();
        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'User email is required'
            });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isUnlimited = user.role === 'admin';
        if (!isUnlimited) {
            user.points = Number(user.points || 0) + 1;
        }

        user.pointsHistory.push({
            amount: 1,
            type: 'snake_banana',
            description: 'Won a rare banana in Snake Game',
            timestamp: new Date()
        });
        await user.save();

        res.json({
            success: true,
            unlimited: isUnlimited,
            new_points: isUnlimited ? null : user.points
        });
    } catch (error) {
        console.error('Snake banana claim error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to claim snake banana reward'
        });
    }
});

app.post('/roadmap-a-plus-claim', async (req, res) => {
    try {
        const userEmail = String(req.body.user_email || '').trim().toLowerCase();
        const snakeBestScore = Math.max(0, Math.floor(Number(req.body.snake_best_score) || 0));

        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'User email is required'
            });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.pointsHistory = user.pointsHistory || [];
        const alreadyClaimed = user.pointsHistory.some((entry) => entry?.type === 'roadmap_aplus_bonus');
        if (alreadyClaimed) {
            return res.json({
                success: true,
                awarded: false,
                roadmap_aplus_claimed: true,
                unlimited: user.role === 'admin',
                new_points: user.role === 'admin' ? null : user.points
            });
        }

        const analytics = await buildAnalyticsSnapshot(user);
        const qualifies =
            analytics.bananas_claimed >= 25 &&
            analytics.bananas_spent >= 20 &&
            analytics.time_spent_seconds >= 3600 &&
            snakeBestScore >= 35;

        if (!qualifies) {
            return res.status(400).json({
                success: false,
                message: 'A+ roadmap challenge is not completed yet'
            });
        }

        const isUnlimited = user.role === 'admin';
        if (!isUnlimited) {
            user.points = Number(user.points || 0) + 10;
        }

        user.pointsHistory.push({
            amount: 10,
            type: 'roadmap_aplus_bonus',
            description: 'Completed the A+ roadmap challenge',
            timestamp: new Date()
        });
        await user.save();

        res.json({
            success: true,
            awarded: true,
            bonus_amount: 10,
            roadmap_aplus_claimed: true,
            unlimited: isUnlimited,
            new_points: isUnlimited ? null : user.points
        });
    } catch (error) {
        console.error('Roadmap A+ claim error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to claim A+ roadmap reward'
        });
    }
});

app.get('/analytics/me', async (req, res) => {
    try {
        const userEmail = String(req.query.user_email || '').trim().toLowerCase();
        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'User email is required'
            });
        }

        const user = await User.findOne({ email: userEmail })
            .select('name email regd_no role pointsHistory analytics createdAt -_id')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: await buildAnalyticsSnapshot(user)
        });
    } catch (error) {
        console.error('Get analytics me error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load analytics'
        });
    }
});

app.get('/analytics/users', async (req, res) => {
    try {
        const adminEmail = String(req.query.admin_email || '').trim().toLowerCase();
        if (!adminEmail) {
            return res.status(400).json({
                success: false,
                message: 'Admin email is required'
            });
        }

        const adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view analytics'
            });
        }

        const users = await User.find({})
            .select('name email regd_no role pointsHistory analytics createdAt -_id')
            .sort({ role: 1, name: 1, email: 1 })
            .lean();

        res.json({
            success: true,
            users: await Promise.all(users.map((user) => buildAnalyticsSnapshot(user)))
        });
    } catch (error) {
        console.error('Get analytics users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load analytics'
        });
    }
});

// Create offer
app.post('/create-offer', async (req, res) => {
    try {
        const { title, description, sent_by, receiver_email, points_amount, qr_open_offer } = req.body;
        const amount = parseInt(points_amount);
        const normalizedReceiverEmail = String(receiver_email || '').trim().toLowerCase();
        const forcedQrMode = req.query.qr === '1' || String(req.headers['x-offer-mode'] || '').toLowerCase() === 'qr';
        const isQrOffer = forcedQrMode || qr_open_offer === true || qr_open_offer === 'true' || !normalizedReceiverEmail;
        let receiver = null;

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid points amount'
            });
        }

        if (!isQrOffer) {
            receiver = await User.findOne({ email: normalizedReceiverEmail });
            if (!receiver) {
                return res.status(400).json({
                    success: false,
                    message: 'Receiver email not found'
                });
            }
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
                description: isQrOffer ? `Sent offer: ${title} via QR` : `Sent offer: ${title} to ${receiver.name}`,
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
                description: isQrOffer ? `Sent offer: ${title} via QR` : `Sent offer: ${title} to ${receiver.name}`,
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
                description: isQrOffer ? `Sent offer: ${title} via QR` : `Sent offer: ${title} to ${receiver.name}`,
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
            receiver_email: isQrOffer ? null : normalizedReceiverEmail,
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

app.get('/offer-details/:offer_id', async (req, res) => {
    try {
        const { offer_id } = req.params;
        const userEmail = String(req.query.user_email || '').trim().toLowerCase();

        const offer = await Offer.findOne({
            offer_id: String(offer_id),
            status: 'pending'
        }).lean();

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found or already claimed'
            });
        }

        if (offer.receiver_email && offer.receiver_email !== userEmail) {
            return res.status(403).json({
                success: false,
                message: 'This offer is assigned to another user'
            });
        }

        const sender = await User.findOne({ regd_no: offer.sent_by }).select('name email -_id').lean();

        res.json({
            success: true,
            offer: {
                offer_id: offer.offer_id,
                title: offer.title,
                description: offer.description,
                points_amount: offer.points_amount,
                sent_by: sender?.name || offer.sent_by,
                sender_email: sender?.email || '',
                receiver_email: offer.receiver_email || null,
                createdAt: offer.createdAt
            }
        });
    } catch (error) {
        console.error('Get offer details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get offer details: ' + error.message
        });
    }
});

// Update the claim offer endpoint
app.post('/claim-offer', async (req, res) => {
    try {
        const { offer_id, user_email } = req.body;
        const normalizedUserEmail = String(user_email || '').trim().toLowerCase();
        
        // Find the offer
        const offer = await Offer.findOne({ 
            offer_id: offer_id,
            status: 'pending'
        });
        
        if (!offer) {
            return res.status(400).json({
                success: false,
                message: 'Offer not found or already claimed'
            });
        }

        if (offer.receiver_email && offer.receiver_email !== normalizedUserEmail) {
            return res.status(403).json({
                success: false,
                message: 'This offer is assigned to another user'
            });
        }
        
        // Update user points
        const user = await User.findOne({ email: normalizedUserEmail });
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
        if (!offer.receiver_email) {
            offer.receiver_email = normalizedUserEmail;
        }
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

app.get('/leaderboard/students', async (_req, res) => {
    try {
        const users = await User.find({ role: 'user' })
            .select('name email points -_id')
            .sort({ points: -1, name: 1, email: 1 })
            .limit(3)
            .lean();

        res.json({
            success: true,
            users: users.map((user) => ({
                name: user.name || '',
                email: user.email || '',
                points: Number(user.points || 0)
            }))
        });
    } catch (error) {
        console.error('Get student leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load student leaderboard'
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

app.get('/notification-targets', async (req, res) => {
    try {
        const adminEmail = String(req.query.admin_email || '').trim();
        const query = String(req.query.query || '').trim();
        if (!adminEmail) {
            return res.status(400).json({ success: false, message: 'Admin email is required' });
        }

        const adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admins can access notification targets' });
        }

        const filters = { role: { $ne: 'admin' } };
        if (query) {
            filters.email = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        }

        const users = await User.find(filters)
            .select('name email role -_id')
            .sort({ name: 1, email: 1 });

        res.json({
            success: true,
            users,
            active_users: getActiveUserEmails()
        });
    } catch (error) {
        console.error('Notification targets error:', error);
        res.status(500).json({ success: false, message: 'Failed to load users: ' + error.message });
    }
});

app.post('/send-notification', async (req, res) => {
    try {
        const {
            admin_email,
            headline,
            message,
            animation
        } = req.body;

        const adminEmail = String(admin_email || '').trim();
        const cleanedHeadline = String(headline || '').trim();
        const cleanedMessage = String(message || '').trim();
        const cleanedAnimation = String(animation || 'bounce').trim();

        if (!adminEmail || !cleanedHeadline || !cleanedMessage) {
            return res.status(400).json({ success: false, message: 'Admin, headline, and message are required' });
        }

        if (!['bounce', 'slide', 'glow'].includes(cleanedAnimation)) {
            return res.status(400).json({ success: false, message: 'Invalid animation selected' });
        }

        const adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admins can send notifications' });
        }

        const targetUsers = await User.find({ role: { $ne: 'admin' } }).select('email -_id');
        const resolvedTargetEmails = targetUsers.map((user) => user.email);

        if (resolvedTargetEmails.length === 0) {
            return res.status(400).json({ success: false, message: 'No users are available right now' });
        }

        const notificationDoc = await Notification.create({
            notification_id: new mongoose.Types.ObjectId().toString(),
            sender_email: adminUser.email,
            sender_name: adminUser.name,
            target_email: null,
            target_emails: resolvedTargetEmails,
            headline: cleanedHeadline,
            message: cleanedMessage,
            animation: cleanedAnimation
        });

        await broadcastNotification(notificationDoc);

        res.json({
            success: true,
            message: `Notification sent to ${resolvedTargetEmails.length} users`,
            notification: serializeNotification(notificationDoc)
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to send notification: ' + error.message });
    }
});

app.get('/notifications/list/:email', async (req, res) => {
    try {
        const email = String(req.params.email || '').trim();
        const since = req.query.since ? new Date(String(req.query.since)) : null;
        const filter = {
            $or: [
                { target_email: email },
                { target_emails: email },
                { target_email: null }
            ]
        };

        if (since && !Number.isNaN(since.getTime())) {
            filter.createdAt = { $gt: since };
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: 1 })
            .limit(25);

        res.json({
            success: true,
            notifications: notifications.map(serializeNotification)
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to load notifications: ' + error.message });
    }
});

app.get('/notifications/stream/:email', (req, res) => {
    const email = String(req.params.email || '').trim();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write('retry: 3000\n\n');

    addNotificationClient(email, res);

    const heartbeat = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        removeNotificationClient(email, res);
        res.end();
    });
});

module.exports = app;
