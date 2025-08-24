const axios = require('axios');

class ContentFilter {
  // Keywords-based filtering
  static filterByKeywords(text, keywords = []) {
    if (!text || typeof text !== 'string') {
      return { safe: true, score: 0, matches: [] };
    }
    
    const lowerText = text.toLowerCase();
    const matches = [];
    
    // Predefined harmful content keywords if none provided
    const defaultKeywords = [
      // Hate speech
      'slur', 'racist', 'bigot',
      // Violence
      'kill', 'murder', 'attack',
      // Self-harm
      'suicide', 'self-harm',
      // Harassment
      'harassment', 'bully'
      // Note: In a real implementation, you would have a much more comprehensive list
    ];
    
    const keywordsToCheck = keywords.length > 0 ? keywords : defaultKeywords;
    
    // Check for matches
    keywordsToCheck.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    });
    
    // Calculate safety score (0 = safe, higher = more harmful)
    const score = matches.length;
    
    return {
      safe: score === 0,
      score,
      matches
    };
  }

  // Pattern-based filtering (e.g., for personal info, contact details)
  static filterByPatterns(text) {
    if (!text || typeof text !== 'string') {
      return { safe: true, score: 0, matches: [] };
    }
    
    const patterns = [
      // Phone numbers
      { type: 'phone', regex: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
      // Email addresses
      { type: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
      // URLs
      { type: 'url', regex: /(https?:\/\/[^\s]+)/g },
      // IP addresses
      { type: 'ip', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
      // Credit card numbers
      { type: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g }
    ];
    
    const matches = [];
    
    // Check for matches
    patterns.forEach(pattern => {
      const found = text.match(pattern.regex);
      if (found && found.length > 0) {
        matches.push({
          type: pattern.type,
          instances: found
        });
      }
    });
    
    // Calculate safety score
    const score = matches.reduce((total, match) => total + match.instances.length, 0);
    
    return {
      safe: score === 0,
      score,
      matches
    };
  }

  // External API content moderation (optional)
  static async checkWithExternalAPI(text) {
    try {
      // This is a placeholder for integrating with external content moderation APIs
      // like Azure Content Moderator, Google Perspective API, etc.
      
      // In a real implementation, you would make an API call like:
      // const response = await axios.post('https://api.contentmoderator.com/check', {
      //   text: text
      // }, {
      //   headers: {
      //     'Ocp-Apim-Subscription-Key': process.env.CONTENT_MODERATOR_KEY
      //   }
      // });
      
      // For now, we'll just return a mock response
      return {
        safe: true,
        score: 0,
        categories: {
          hate: 0,
          harassment: 0,
          selfHarm: 0,
          sexual: 0,
          violence: 0
        }
      };
    } catch (error) {
      console.error('Error checking content with external API:', error);
      // Fall back to internal filtering if API fails
      return this.filterByKeywords(text);
    }
  }

  // Combined filtering with configurable threshold
  static async filterContent(text, options = {}) {
    try {
      const {
        useKeywords = true,
        usePatterns = true,
        useExternalAPI = false,
        threshold = 1,
        keywords = []
      } = options;
      
      const results = [];
      
      // Apply selected filters
      if (useKeywords) {
        results.push(this.filterByKeywords(text, keywords));
      }
      
      if (usePatterns) {
        results.push(this.filterByPatterns(text));
      }
      
      if (useExternalAPI) {
        results.push(await this.checkWithExternalAPI(text));
      }
      
      // Combine results
      const totalScore = results.reduce((sum, result) => sum + result.score, 0);
      const allMatches = results.flatMap(result => result.matches);
      
      return {
        safe: totalScore < threshold,
        score: totalScore,
        matches: allMatches,
        flagged: totalScore >= threshold
      };
    } catch (error) {
      console.error('Error filtering content:', error);
      // Default to flagging content if filtering fails
      return {
        safe: false,
        score: 999,
        matches: [],
        flagged: true,
        error: error.message
      };
    }
  }
}

module.exports = ContentFilter;