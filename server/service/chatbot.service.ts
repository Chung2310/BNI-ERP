/**
 * Chatbot Service
 * ───────────────
 * Trợ lý ảo AI cho hệ thống iGen Connect. Truy vấn dữ liệu thời gian thực thuộc
 * doanh nghiệp của người dùng (theo companyCode) rồi dựng system prompt giàu
 * ngữ cảnh, gọi OpenRouter (có fallback 3 tầng) để sinh câu trả lời.
 */

import { openrouterChat, type OpenRouterMessage } from "./openrouter.service";
import { UserModel } from "../model/user.model";

export interface ChatbotMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatbotUser {
  id: string;
  email: string;
  role: string;
  companyCode?: string;
}

export class ChatbotService {
  static async getResponse(user: ChatbotUser, messages: ChatbotMessage[]): Promise<string> {
    const companyCode = user.companyCode;
    const model = process.env.CHATBOT_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

    if (!companyCode) {
      // Không có doanh nghiệp gắn với tài khoản → trả lời chung chung, không có dữ liệu nội bộ
      const generalPrompt: OpenRouterMessage = {
        role: "system",
        content:
          "Bạn là trợ lý ảo AI của hệ thống iGen Connect. Tài khoản hiện tại chưa được gắn với doanh nghiệp nào " +
          "nên bạn không truy cập được dữ liệu nội bộ. Hãy hỗ trợ người dùng bằng kiến thức chung về vận hành, " +
          "quản lý nhân sự... Trả lời bằng tiếng Việt lịch sự, dễ hiểu, thuần văn bản (PLAIN TEXT), " +
          "TUYỆT ĐỐI KHÔNG dùng các ký tự định dạng Markdown như dấu thăng #, dấu sao **, *, gạch chân __, gạch ngược ` hay link [text](url).",
      };
      const { text } = await openrouterChat({
        model,
        messages: [generalPrompt, ...this.normalizeMessages(messages)],
      });
      return this.cleanMarkdownText(text);
    }

    const userCount = await UserModel.countDocuments({ companyCode, isActive: { $ne: false } });

    // Dựng System Prompt giàu ngữ cảnh
    const systemPrompt: OpenRouterMessage = {
      role: "system",
      content: `Bạn là trợ lý ảo AI của hệ thống iGen Connect, hỗ trợ trực tiếp cho nhân sự của doanh nghiệp (mã: ${companyCode}).
Bạn có quyền truy cập dữ liệu thời gian thực dưới đây. Hãy trả lời câu hỏi dựa trên dữ liệu này:
- Tổng số lượng nhân sự đang hoạt động: ${userCount} nhân sự

QUY TẮC PHẢN HỒI:
- Trả lời bằng tiếng Việt lịch sự, thân thiện, dễ hiểu, thuần văn bản (PLAIN TEXT).
- TUYỆT ĐỐI KHÔNG sử dụng bất kỳ ký tự định dạng Markdown nào (như dấu thăng #, ##, dấu sao **, *, gạch chân __, _, thẻ mã code, hay link).
- Để trình bày danh sách hoặc nhiều ý, chỉ dùng dấu gạch ngang (-) thuần túy ở đầu dòng hoặc đánh số thứ tự (1, 2, 3) đơn giản, xuống dòng rõ ràng.
- Chỉ dựa trên dữ liệu thực tế ở trên. Nếu người dùng hỏi về đối tượng không có trong dữ liệu, hãy báo lịch sự rằng không tìm thấy trong hệ thống của doanh nghiệp.
- Tuyệt đối không bịa dữ liệu không có trong ngữ cảnh.`,
    };

    const { text } = await openrouterChat({
      model,
      messages: [systemPrompt, ...this.normalizeMessages(messages)],
    });

    return this.cleanMarkdownText(text);
  }

  private static normalizeMessages(messages: ChatbotMessage[]): OpenRouterMessage[] {
    return messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.trim(),
      }));
  }

  /**
   * Bộ lọc triệt để mọi cú pháp Markdown, trả về chuỗi văn bản thuần túy (Plain Text).
   */
  private static cleanMarkdownText(raw: string): string {
    if (!raw) return "";

    let text = raw;

    // 1. Xóa khối mã (code block) ```ts ... ``` -> lấy nội dung bên trong
    text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1");

    // 2. Xóa inline code `code`
    text = text.replace(/`([^`]+)`/g, "$1");

    // 3. Xóa tiêu đề Markdown (# Title, ## Subtitle, v.v.)
    text = text.replace(/^#{1,6}\s+(.*)$/gm, "$1");

    // 4. Xóa link [text](url) -> giữ lại "text (url)" hoặc chỉ "text"
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

    // 5. Xóa ảnh ![alt](url) -> xóa hẳn
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

    // 6. Xóa chữ in đậm/nghiêng: ***text***, **text**, *text*, ___text___, __text__, _text_
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/(^|[^\*])\*([^*\n]+)\*([^\*]|$)/g, "$1$2$3");
    text = text.replace(/___([^_]+)___/g, "$1");
    text = text.replace(/__([^_]+)__/g, "$1");
    text = text.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1$2$3");

    // 7. Xóa gạch ngang chữ ~~text~~
    text = text.replace(/~~([^~]+)~~/g, "$1");

    // 8. Xóa trích dẫn > quote
    text = text.replace(/^>\s?(.*)$/gm, "$1");

    // 9. Xóa đường kẻ ngang --- hoặc *** hoặc ___
    text = text.replace(/^[-*_]{3,}\s*$/gm, "");

    // 10. Chuẩn hóa khoảng trống thừa và dòng trống liên tiếp (tối đa 2 dòng trống)
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text;
  }
}
