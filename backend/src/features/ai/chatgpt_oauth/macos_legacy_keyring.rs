//! Legacy imports must fail rather than opening one authorization dialog per chunk.
//! Never change the process-wide Keychain interaction policy or any item's ACL.
use core_foundation::{
    base::{CFType, CFTypeRef, TCFType},
    boolean::CFBoolean,
    data::CFData,
    dictionary::CFDictionary,
    string::{CFString, CFStringRef},
};
use security_framework_sys::{
    item::*,
    keychain_item::{SecItemCopyMatching, SecItemDelete},
};
use zeroize::Zeroizing;

// This public Apple constant is not exposed by security-framework-sys 2.x.
#[link(name = "Security", kind = "framework")]
extern "C" {
    static kSecUseAuthenticationUIFail: CFStringRef;
}

fn query(key: &str, read_data: bool) -> CFDictionary<CFString, CFType> {
    // SAFETY: Security exports these immutable CFString constants. The dictionary
    // retains each key/value and the wrappers use the borrowed/get ownership rule.
    unsafe {
        let mut pairs = vec![
            (
                CFString::wrap_under_get_rule(kSecClass),
                CFString::wrap_under_get_rule(kSecClassGenericPassword).as_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecAttrService),
                CFString::new(crate::features::credentials::AI_KEYRING_SERVICE).as_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecAttrAccount),
                CFString::new(key).as_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecUseAuthenticationUI),
                CFString::wrap_under_get_rule(kSecUseAuthenticationUIFail).as_CFType(),
            ),
        ];
        if read_data {
            pairs.push((
                CFString::wrap_under_get_rule(kSecReturnData),
                CFBoolean::true_value().as_CFType(),
            ));
        }
        CFDictionary::from_CFType_pairs(&pairs)
    }
}

pub(super) fn read(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    if key.is_empty() {
        return Err("Invalid legacy credential identifier".into());
    }
    let query = query(key, true);
    let mut result: CFTypeRef = std::ptr::null();
    // SAFETY: CF owns the live query; result is an out pointer. A non-null result
    // is released below under the create ownership rule, including error paths.
    let status = unsafe { SecItemCopyMatching(query.as_concrete_TypeRef(), &mut result) };
    let result = if result.is_null() {
        None
    } else {
        Some(unsafe { CFType::wrap_under_create_rule(result) })
    };
    match status {
        -25300 => Ok(None), // errSecItemNotFound, not a permission denial.
        0 => {
            let data = result
                .and_then(|value| value.downcast::<CFData>())
                .ok_or("Invalid legacy keyring data")?;
            if data.len() > 256 * 1024 {
                return Err("Legacy keyring record exceeded its size limit".into());
            }
            String::from_utf8(data.bytes().to_vec())
                .map(|value| Some(Zeroizing::new(value)))
                .map_err(|_| "Invalid legacy keyring encoding".into())
        }
        _ => Err(super::secret_storage::LEGACY_ACCESS_REQUIRED.into()),
    }
}

pub(super) fn delete(key: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("Invalid legacy credential identifier".into());
    }
    let query = query(key, false);
    // SAFETY: The live dictionary specifies one exact service/account pair and
    // forbids authentication UI; it cannot match other providers or generations.
    match unsafe { SecItemDelete(query.as_concrete_TypeRef()) } {
        0 | -25300 => Ok(()),
        _ => Err("Signed out locally, but legacy keyring cleanup needs permission. Older items were retained; no further prompts were opened.".into()),
    }
}
