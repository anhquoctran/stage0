use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum TextEncoding {
    Utf8,
    Utf8Bom,
    Utf16Le,
    Utf16Be,
    Windows1250,
    Windows1251,
    Windows1252,
    Windows1253,
    Windows1254,
    Windows1255,
    Windows1256,
    Windows1257,
    Windows1258,
    Windows874,
    Iso8859_1,
    Iso8859_2,
    Iso8859_4,
    Iso8859_5,
    Iso8859_6,
    Iso8859_7,
    Iso8859_8,
    Iso8859_9,
    Iso8859_11,
    Iso8859_13,
    Iso8859_15,
    Koi8R,
    Koi8U,
    Ibm437,
    Ibm850,
    Ibm852,
    Ibm865,
    Ibm866,
    Macintosh,
    ShiftJis,
    EucJp,
    EucKr,
    Gb2312,
    Gbk,
    Gb18030,
    Big5,
}

impl TextEncoding {
    pub const ALL: [Self; 40] = [
        Self::Utf8,
        Self::Utf8Bom,
        Self::Utf16Le,
        Self::Utf16Be,
        Self::Windows1250,
        Self::Windows1251,
        Self::Windows1252,
        Self::Windows1253,
        Self::Windows1254,
        Self::Windows1255,
        Self::Windows1256,
        Self::Windows1257,
        Self::Windows1258,
        Self::Windows874,
        Self::Iso8859_1,
        Self::Iso8859_2,
        Self::Iso8859_4,
        Self::Iso8859_5,
        Self::Iso8859_6,
        Self::Iso8859_7,
        Self::Iso8859_8,
        Self::Iso8859_9,
        Self::Iso8859_11,
        Self::Iso8859_13,
        Self::Iso8859_15,
        Self::Koi8R,
        Self::Koi8U,
        Self::Ibm437,
        Self::Ibm850,
        Self::Ibm852,
        Self::Ibm865,
        Self::Ibm866,
        Self::Macintosh,
        Self::ShiftJis,
        Self::EucJp,
        Self::EucKr,
        Self::Gb2312,
        Self::Gbk,
        Self::Gb18030,
        Self::Big5,
    ];

    pub fn name(self) -> &'static str {
        use TextEncoding::*;
        match self {
            Utf8 => "UTF-8",
            Utf8Bom => "UTF-8 with BOM",
            Utf16Le => "UTF-16 LE",
            Utf16Be => "UTF-16 BE",
            Windows1250 => "Windows-1250",
            Windows1251 => "Windows-1251",
            Windows1252 => "Windows-1252",
            Windows1253 => "Windows-1253",
            Windows1254 => "Windows-1254",
            Windows1255 => "Windows-1255",
            Windows1256 => "Windows-1256",
            Windows1257 => "Windows-1257",
            Windows1258 => "Windows-1258",
            Windows874 => "Windows-874",
            Iso8859_1 => "ISO-8859-1",
            Iso8859_2 => "ISO-8859-2",
            Iso8859_4 => "ISO-8859-4",
            Iso8859_5 => "ISO-8859-5",
            Iso8859_6 => "ISO-8859-6",
            Iso8859_7 => "ISO-8859-7",
            Iso8859_8 => "ISO-8859-8",
            Iso8859_9 => "ISO-8859-9",
            Iso8859_11 => "ISO-8859-11",
            Iso8859_13 => "ISO-8859-13",
            Iso8859_15 => "ISO-8859-15",
            Koi8R => "KOI8-R",
            Koi8U => "KOI8-U",
            Ibm437 => "IBM437",
            Ibm850 => "IBM850",
            Ibm852 => "IBM852",
            Ibm865 => "IBM865",
            Ibm866 => "IBM866",
            Macintosh => "Macintosh",
            ShiftJis => "Shift JIS",
            EucJp => "EUC-JP",
            EucKr => "EUC-KR",
            Gb2312 => "GB2312",
            Gbk => "GBK",
            Gb18030 => "GB18030",
            Big5 => "Big5",
        }
    }

    pub fn for_label(label: &str) -> Option<Self> {
        let key = normalize(label);
        if let Some(encoding) = Self::ALL
            .iter()
            .find(|encoding| normalize(encoding.name()) == key)
        {
            return Some(*encoding);
        }
        match key.as_str() {
            "utf8bom" | "utf8sig" => Some(Self::Utf8Bom),
            "latin1" => Some(Self::Iso8859_1),
            "cp437" => Some(Self::Ibm437),
            "cp850" => Some(Self::Ibm850),
            "cp852" => Some(Self::Ibm852),
            "cp865" => Some(Self::Ibm865),
            "cp866" => Some(Self::Ibm866),
            "sjis" | "cp932" | "windows31j" => Some(Self::ShiftJis),
            "cp936" => Some(Self::Gbk),
            "cp949" => Some(Self::EucKr),
            "cp950" => Some(Self::Big5),
            "macroman" => Some(Self::Macintosh),
            _ if key.starts_with("cp") => Self::for_label(&format!("Windows-{}", &key[2..])),
            _ => None,
        }
    }

    pub(super) fn codec(self) -> Option<&'static encoding_rs::Encoding> {
        use TextEncoding::*;
        match self {
            Utf8 | Utf8Bom => Some(encoding_rs::UTF_8),
            Utf16Le => Some(encoding_rs::UTF_16LE),
            Utf16Be => Some(encoding_rs::UTF_16BE),
            Iso8859_1 | Ibm437 | Ibm850 | Ibm852 | Ibm865 => None,
            Iso8859_9 => Some(encoding_rs::WINDOWS_1254),
            Iso8859_11 => Some(encoding_rs::WINDOWS_874),
            Gb2312 => Some(encoding_rs::GBK),
            ShiftJis => Some(encoding_rs::SHIFT_JIS),
            _ => encoding_rs::Encoding::for_label(self.name().as_bytes()),
        }
    }
}

fn normalize(label: &str) -> String {
    label
        .chars()
        .filter(|c| !matches!(c, '-' | '_' | ' '))
        .flat_map(char::to_lowercase)
        .collect()
}
