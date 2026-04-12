"""
Tests for section_properties utility.

Analytical verification:
  - Rectangle 100x200: I = 100*200^3/12/1e4 = 6666.6667 cm4, A = 100*200/100 = 200.0 cm2
  - Circle d=100: I = pi*100^4/64/1e4 = 490.8739 cm4, A = pi*100^2/4/100 = 78.5398 cm2
  - I-section b=100,H=200,tf=10,tw=8: hw=180, I=(100*200^3/12 - 92*180^3/12)/1e4 = 2195.4667 cm4,
    A=(2*100*10 + 8*180)/100 = 34.40 cm2
"""
import math
import pytest

from pda_analysis_software.utils.section_properties import section_properties


def test_rectangle():
    I_cm4, A_cm2 = section_properties('rectangle', b=100, h=200)
    expected_I = 100 * 200**3 / 12 / 1e4
    expected_A = 100 * 200 / 100
    assert I_cm4 == pytest.approx(expected_I, rel=1e-6)
    assert A_cm2 == pytest.approx(expected_A, rel=1e-6)


def test_circle():
    I_cm4, A_cm2 = section_properties('circle', d=100)
    expected_I = math.pi * 100**4 / 64 / 1e4
    expected_A = math.pi * 100**2 / 4 / 100
    assert I_cm4 == pytest.approx(expected_I, rel=1e-6)
    assert A_cm2 == pytest.approx(expected_A, rel=1e-6)


def test_i_section():
    I_cm4, A_cm2 = section_properties('i_section', b=100, H=200, tf=10, tw=8)
    hw = 200 - 2 * 10  # = 180
    expected_I = (100 * 200**3 / 12 - (100 - 8) * hw**3 / 12) / 1e4
    expected_A = (2 * 100 * 10 + 8 * hw) / 100
    assert I_cm4 == pytest.approx(expected_I, rel=1e-6)
    assert A_cm2 == pytest.approx(expected_A, rel=1e-6)


def test_unknown_type():
    with pytest.raises(ValueError):
        section_properties('triangle', b=100, h=200)
