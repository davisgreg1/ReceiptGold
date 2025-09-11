"use strict";
// Update subscription document (tier changes handled by RevenueCat webhook)
try {
    if (currentSub.exists) {
        await subscriptionRef.update(subscriptionUpdateData);
    }
    else {
        // Create new subscription document if it doesn't exist
        const createData = {
            ...subscriptionUpdateData,
            userId: userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await subscriptionRef.set(createData);
    }
    functions.logger.info('✅ Subscription billing updated successfully', {
        subscriptionUpdated: true,
        userId,
        subscriptionId
    });
}
catch (updateError) {
    functions.logger.error('❌ Subscription update failed', updateError);
    throw new HttpsError('internal', 'Failed to update subscription');
}
// Log successful completion
functions.logger.info('🎉 Subscription billing update completed successfully', {
    userId,
    subscriptionId
});
return {
    success: true,
    receiptsExcluded: 0,
    tierChange: false
};
//# sourceMappingURL=temp_replacement.js.map