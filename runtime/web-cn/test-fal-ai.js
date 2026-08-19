// 测试 fal.ai nano-banana-pro 图片生成
const FAL_API_KEY = process.env.FAL_API_KEY || 'b4694091-bbfc-4c3d-92fd-37187e74bc58:29f281ced5b472e8880779f1b651e9e8';
const FAL_API_URL = 'https://fal.run/fal-ai/nano-banana-pro';

async function testFalAI() {
    console.log('Testing fal.ai nano-banana-pro image generation...\n');

    const testPrompt = 'A cute cat sitting on a windowsill, soft lighting, high quality';
    const size = { width: 512, height: 512 };

    try {
        console.log('1. Submitting image generation request...');
        const submitResponse = await fetch(FAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`,
            },
            body: JSON.stringify({
                prompt: testPrompt,
                image_size: size,
                num_images: 1,
            }),
        });

        if (!submitResponse.ok) {
            const error = await submitResponse.text();
            throw new Error(`Submit failed: ${error}`);
        }

        const submitData = await submitResponse.json();
        const requestId = submitData.request_id;
        console.log(`   Request ID: ${requestId}`);

        console.log('\n2. Polling for result...');
        let result = null;
        const maxAttempts = 60;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const statusResponse = await fetch(`${FAL_API_URL}/requests/${requestId}`, {
                headers: {
                    'Authorization': `Key ${FAL_API_KEY}`,
                },
            });

            if (!statusResponse.ok) {
                console.log(`   Attempt ${i + 1}: Waiting...`);
                continue;
            }

            const statusData = await statusResponse.json();
            console.log(`   Attempt ${i + 1}: Status = ${statusData.status}`);

            if (statusData.status === 'completed') {
                result = statusData;
                break;
            } else if (statusData.status === 'failed') {
                throw new Error(`Generation failed: ${statusData.error}`);
            }
        }

        if (!result) {
            throw new Error('Generation timeout');
        }

        const imageUrl = result.images?.[0]?.url || result.image?.url;
        console.log('\n✅ Success! Image URL:', imageUrl);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

testFalAI();
