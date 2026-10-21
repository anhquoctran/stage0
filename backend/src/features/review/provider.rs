//! Native provider wire protocol: endpoint policy, message encoding, bounded transport and decoding.
mod decode;
mod endpoint;
mod messages;
mod transport;

pub use decode::decode;
pub use endpoint::endpoint;
pub use messages::{append_results, initial_history, payload};
pub use transport::request;

#[cfg(test)]
mod tests;
