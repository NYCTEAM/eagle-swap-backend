/**
 * 翻译服务 - 使用 Google Translate API
 */

import https from 'https';

interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
}

class TranslationService {
  /**
   * 使用 Google Translate 免费 API 翻译文本
   * 从英文翻译到中文
   */
  async translateToZh(text: string): Promise<string> {
    try {
      // 如果文本为空或太短，不翻译
      if (!text || text.trim().length < 3) {
        return '';
      }

      // 检测是否已经是中文
      if (this.isChinese(text)) {
        return text;
      }

      // 使用 Google Translate 免费 API
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodedText}`;

      const result = await this.makeRequest(url);
      
      if (result && Array.isArray(result) && result[0]) {
        // Google Translate 返回格式: [[["翻译文本","原文本",null,null,3]]]
        const translations = result[0];
        let translatedText = '';
        
        for (const item of translations) {
          if (item && item[0]) {
            translatedText += item[0];
          }
        }
        
        return translatedText.trim();
      }

      return '';
    } catch (error) {
      console.error('Translation error:', error);
      return '';
    }
  }

  /**
   * 批量翻译
   */
  async translateBatch(texts: string[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const text of texts) {
      const translated = await this.translateToZh(text);
      results.push(translated);
      
      // 避免请求过快
      await this.sleep(100);
    }
    
    return results;
  }

  /**
   * 检测文本是否包含中文
   */
  private isChinese(text: string): boolean {
    // 检测是否包含中文字符
    const chineseRegex = /[\u4e00-\u9fa5]/;
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalLength = text.length;
    
    // 如果中文字符超过30%，认为是中文文本
    return chineseCount / totalLength > 0.3;
  }

  /**
   * 发起 HTTPS 请求
   */
  private makeRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new TranslationService();
