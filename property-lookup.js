
const https = require('https');

// RentCast API configuration
const RENTCAST_API_KEY = 'Bd22259f5a0948e0bf057c92e59315e3';
const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1';

// Cleaning quote calculation logic
function calculateCleaningQuote(propertyData) {
    const baseRate = 80; // Base cleaning rate
    let additionalCharges = 0;
    
    // Calculate based on square footage
    const sqft = propertyData.squareFootage || 1200; // Default if not available
    if (sqft > 2000) {
        additionalCharges += 40;
    } else if (sqft > 1500) {
        additionalCharges += 25;
    } else if (sqft > 1000) {
        additionalCharges += 15;
    }
    
    // Calculate based on bedrooms
    const bedrooms = propertyData.bedrooms || 2;
    if (bedrooms > 3) {
        additionalCharges += (bedrooms - 3) * 15;
    }
    
    // Calculate based on bathrooms
    const bathrooms = propertyData.bathrooms || 1;
    if (bathrooms > 2) {
        additionalCharges += (bathrooms - 2) * 20;
    }
    
    const total = baseRate + additionalCharges;
    
    return {
        baseRate,
        additionalCharges,
        total,
        breakdown: {
            squareFootage: sqft,
            bedrooms,
            bathrooms
        }
    };
}

// Function to make API request to RentCast
function makeRentCastRequest(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        const queryString = new URLSearchParams(params).toString();
        const url = `${RENTCAST_BASE_URL}${endpoint}?${queryString}`;
        
        const options = {
            method: 'GET',
            headers: {
                'X-Api-Key': RENTCAST_API_KEY,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(jsonData);
                    } else {
                        reject(new Error(jsonData.message || `API Error: ${res.statusCode}`));
                    }
                } catch (error) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { address } = JSON.parse(event.body);
        
        if (!address) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Address is required' })
            };
        }
        
        // Call RentCast API to get property details
        const propertyData = await makeRentCastRequest('/properties', {
            address: address,
            limit: 1
        });
        
        if (!propertyData || !propertyData.length) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Property not found' })
            };
        }
        
        const property = propertyData[0];
        
        // Calculate cleaning quote
        const quote = calculateCleaningQuote({
            squareFootage: property.squareFootage,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                property: {
                    address: property.address || address,
                    squareFootage: property.squareFootage,
                    bedrooms: property.bedrooms,
                    bathrooms: property.bathrooms
                },
                quote
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to process request',
                details: error.message 
            })
        };
    }
};
