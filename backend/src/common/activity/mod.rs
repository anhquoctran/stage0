//! Coordinates application work with an exclusive software installation.
mod activity_gate;
mod installation_lease;
mod operation_lease;

pub use installation_lease::InstallationLease;
pub use operation_lease::OperationLease;

#[cfg(test)]
mod tests;
