//! Optimized regression coverage for RUSTSEC-2024-0429.

#[cfg(test)]
mod tests {
    use glib::variant::ToVariant;

    #[test]
    fn every_affected_iterator_method_returns_valid_strings() {
        let variant = ["zero", "one", "two", "three"].to_variant();
        assert_eq!(variant.array_iter_str().unwrap().next(), Some("zero"));
        assert_eq!(variant.array_iter_str().unwrap().next_back(), Some("three"));
        assert_eq!(variant.array_iter_str().unwrap().nth(1), Some("one"));
        assert_eq!(variant.array_iter_str().unwrap().nth_back(1), Some("two"));
        assert_eq!(variant.array_iter_str().unwrap().last(), Some("three"));
        assert_eq!(
            variant.array_iter_str().unwrap().collect::<Vec<_>>(),
            ["zero", "one", "two", "three"]
        );
    }

    #[test]
    fn mixed_direction_iteration_preserves_the_borrowed_strings() {
        let variant = ["", "héllo", "world", "tail"].to_variant();
        let mut iter = variant.array_iter_str().unwrap();
        assert_eq!(iter.next(), Some(""));
        assert_eq!(iter.next_back(), Some("tail"));
        assert_eq!(iter.nth(0), Some("héllo"));
        assert_eq!(iter.nth_back(0), Some("world"));
        assert_eq!(iter.next(), None);
        assert_eq!(iter.next_back(), None);
        assert_eq!(iter.len(), 0);
    }

    #[test]
    fn empty_arrays_never_read_a_null_out_parameter() {
        let variant = Vec::<String>::new().to_variant();
        assert_eq!(variant.array_iter_str().unwrap().next(), None);
        assert_eq!(variant.array_iter_str().unwrap().next_back(), None);
        assert_eq!(variant.array_iter_str().unwrap().nth(0), None);
        assert_eq!(variant.array_iter_str().unwrap().nth_back(0), None);
        assert_eq!(variant.array_iter_str().unwrap().last(), None);
    }
}
