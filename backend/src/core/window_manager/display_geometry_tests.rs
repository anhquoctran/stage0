use super::display_geometry::fit_geometry;

#[test]
fn ordinary_work_areas_preserve_current_workspace_and_preferences_sizes() {
    for (desired, minimum) in [
        ((1280.0, 840.0), (1120.0, 800.0)),
        ((1100.0, 800.0), (900.0, 620.0)),
    ] {
        let geometry = fit_geometry(desired, minimum, Some((1920.0, 1040.0)));
        assert_eq!(geometry.size, desired);
        assert_eq!(geometry.minimum, minimum);
    }
}

#[test]
fn high_dpi_work_area_uses_logical_pixels_and_limits_minimums_too() {
    // A 4K display with a 120 physical pixel taskbar at 300% OS scaling.
    let geometry = fit_geometry(
        (1280.0, 840.0),
        (1120.0, 800.0),
        Some((3840.0 / 3.0, 2040.0 / 3.0)),
    );
    assert_eq!(geometry.size, (1248.0, 648.0));
    assert_eq!(geometry.minimum, (1120.0, 648.0));
    let preferences = fit_geometry((1100.0, 800.0), (900.0, 620.0), Some((960.0, 520.0)));
    assert_eq!(preferences.size, (928.0, 488.0));
    assert_eq!(preferences.minimum, (900.0, 488.0));
}

#[test]
fn fractional_scaling_and_native_frames_never_overflow_the_work_area() {
    for scale in [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0] {
        let available = ((3840.0 - 20.0) / scale, (2040.0 - 60.0) / scale);
        let geometry = fit_geometry((1280.0, 840.0), (1120.0, 800.0), Some(available));
        assert!(geometry.size.0 <= available.0 - 32.0);
        assert!(geometry.size.1 <= available.1 - 32.0);
        assert!(geometry.minimum.0 <= geometry.size.0);
        assert!(geometry.minimum.1 <= geometry.size.1);
        assert_eq!(geometry.size.0.fract(), 0.0);
        assert_eq!(geometry.size.1.fract(), 0.0);
    }
}

#[test]
fn unavailable_monitor_keeps_safe_defaults_and_tiny_work_areas_stay_positive() {
    for available in [None, Some((f64::NAN, f64::INFINITY)), Some((0.0, -1.0))] {
        let geometry = fit_geometry((1280.0, 840.0), (1120.0, 800.0), available);
        assert_eq!(geometry.size, (1280.0, 840.0));
        assert_eq!(geometry.minimum, (1120.0, 800.0));
    }
    let geometry = fit_geometry((1280.0, 840.0), (1120.0, 800.0), Some((20.0, 20.0)));
    assert_eq!(geometry.size, (1.0, 1.0));
    assert_eq!(geometry.minimum, (1.0, 1.0));
}

#[test]
fn fitting_monitor_transitions_preserve_fractional_user_geometry() {
    let geometry = fit_geometry((1200.8, 810.4), (1120.0, 800.0), Some((1920.0, 1040.0)));
    assert_eq!(geometry.size, (1200.8, 810.4));
    assert_eq!(geometry.minimum, (1120.0, 800.0));
}
