var metaJSON = $.getJSON("https://uhslc.soest.hawaii.edu/metaapi/select2", function(data) {
    $("#myselect2").select2({
          placeholder:  {
          // id: '2', // the value of the option
          text: 'Search for a station...',
        },
          // selectOnClose: true,
          sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
          tags: false,
          // minimumInputLength: 3,
          tokenSeparators: [',', ' '],
          // ajax: {
          //     dataType : "json",
          //     url      : "states.json",
          // },
          data: data.results,

          // matcher: matchCustom,
      });

      $('#myselect2').val("057").trigger('change');

      $('#myselect2').on('select2:select', function(e) {
        var data = e.params.data;
        stn = data.id;
        console.log(stn);
        // // update the address bar when selection in the dropdown has changed
        // history.pushState(null, '', window.location.pathname + "?stn=" + stn + window.location.hash);
        // loadtabs(stn, getCurrentDate());
        // // If request for json file with Metadata (below fails) there won't be
        // // another attempt to retrive the file again. Maybe should consider
        // // implementing that feature
        // populateMetaDataTables(stn, metaJSON.responseJSON);
      });


    })
    .fail(function(jqXHR, textStatus, errorThrown) {
      alert('Failed to retrieve stations list! ' + textStatus);

    })
    .always(function() {
      // request ended
    });