// Diagnostic script to inspect counters and rewards_claimed claim_id values
const dbDemo = db.getSiblingDB('demo');
print('Counter:');
printjson(dbDemo.counters.findOne({ _id: 'claimedReward' }));
print('Top claim_id by numeric:');
printjson(dbDemo.rewards_claimed.aggregate([
  { $addFields: { claim_id_num: { $toInt: '$claim_id' } } },
  { $sort: { claim_id_num: -1 } },
  { $limit: 5 },
  { $project: { claim_id: 1, claim_id_num: 1 } }
]).toArray());
